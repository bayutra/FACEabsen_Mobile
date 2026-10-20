import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:uuid/uuid.dart';

import '../../../core/crypto/device_keys.dart';
import '../../../core/storage/secure_store.dart';
import '../domain/attendance_models.dart';
import 'outbox_repository.dart';

/// STEP 12 — attendance signals + Ed25519 request signing (PRD §18, §57).
/// Sign message must match the server exactly: "<requestId>.<requestTimestamp>".
class AttendanceRepository {
  AttendanceRepository({required Dio dio, required SecureStore store})
      : _dio = dio,
        _store = store;

  final Dio _dio;
  final SecureStore _store;

  static String signMessage(String requestId, String requestTimestamp) =>
      '$requestId.$requestTimestamp';

  /// Opens the punch-outbox backed by this repository's [SecureStore].
  /// The accessor builds a thin wrapper on demand so existing call sites and
  /// constructors do not change.
  OutboxRepository outbox() => OutboxRepository(store: _store);

  /// True for transport-level failures (no HTTP response): the punch never
  /// reached the server and is safe to queue for retry. Any response —
  /// including 4xx validation rejections — means the server saw the punch
  /// and it must NOT be treated as a network failure. Cancellation is a
  /// user action, never a network failure.
  static bool isNetworkError(DioException e) {
    if (e.type == DioExceptionType.cancel) return false;
    if (e.response != null) return false;
    return e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.unknown;
  }

  /// True when the server was too busy/broken to give a verdict (429 or 5xx).
  /// Unlike validation rejections, these carry NO verdict about the punch —
  /// the row may or may not exist — so the punch stays queued for retry.
  /// Data-safe: a retried punch that actually landed hits the server's
  /// duplicate guards (`ALREADY_CHECKED_IN`, unique schedule row) instead of
  /// creating a second row. Cancellation is never retryable.
  static bool isRetryableServerError(DioException e) {
    if (e.type == DioExceptionType.cancel) return false;
    final int? status = e.response?.statusCode;
    return status == 429 || (status != null && status >= 500);
  }

  /// Shapes the liveness attestation for the wire.
  ///
  /// The server runs a global ValidationPipe with `forbidNonWhitelisted`, so
  /// keys we must NOT send have to be dropped here rather than trimmed there —
  /// and an unknown key fails the whole punch with a 400. A passive run
  /// therefore omits `challenges` (there are none) and sends `padScore`
  /// instead, which is what the server requires to accept that mode.
  @visibleForTesting
  static Map<String, Object?> livenessPayload(Map<String, Object> liveness) {
    final bool passive = liveness['mode'] == 'passive';
    return <String, Object?>{
      'passed': liveness['passed'],
      'completedAt': liveness['completedAt'],
      'score': liveness['score'],
      'mode': passive ? 'passive' : 'active',
      if (!passive) 'challenges': liveness['challenges'],
      if (passive && liveness['padScore'] != null) 'padScore': liveness['padScore'],
    };
  }

  Future<Map<String, dynamic>> _signals({
    required List<double> embedding,
    required Map<String, Object> liveness,
    required String deviceId,
    required bool compromised,
    String? integrityToken,
  }) async {
    final String? seed = await _store.readPrivateSeed();
    if (seed == null || seed.isEmpty) {
      throw StateError('Device key missing — register the device first.');
    }
    final pair = await DeviceKeys.importFromSeedBase64(seed);
    final String requestId = const Uuid().v4();
    final String requestTimestamp = DateTime.now().toUtc().toIso8601String();
    final signature = await DeviceKeys.sign(
      pair,
      utf8.encode(signMessage(requestId, requestTimestamp)),
    );
    return {
      'deviceId': deviceId,
      'faceEmbedding': embedding,
      'liveness': livenessPayload(liveness),
      'requestId': requestId,
      'requestTimestamp': requestTimestamp,
      'signature': base64Encode(signature),
      'deviceCompromised': compromised,
      if (integrityToken != null && integrityToken.isNotEmpty) 'integrityToken': integrityToken,
    };
  }

  /// Throws [AttendanceOffline] when the punch never reached the server
  /// (transport failure) or the server was too busy/broken to give a verdict
  /// (429/5xx — safe to queue, server guards make retry idempotent);
  /// [AttendanceRejected] with server reason otherwise. Pass [cancelToken]
  /// to genuinely abort the socket when the user cancels.
  Future<AttendanceResult> checkIn({
    required List<double> embedding,
    required Map<String, Object> liveness,
    required String deviceId,
    required bool compromised,
    String? integrityToken,
    CancelToken? cancelToken,
  }) async {
    try {
      final Response res = await _dio.post(
        '/attendance/check-in',
        data: await _signals(embedding: embedding, liveness: liveness, deviceId: deviceId, compromised: compromised, integrityToken: integrityToken),
        cancelToken: cancelToken,
      );
      return AttendanceResult.fromCheckIn(Map<String, dynamic>.from(res.data as Map));
    } on DioException catch (e) {
      if (isNetworkError(e) || isRetryableServerError(e)) throw AttendanceOffline(e);
      throw AttendanceRejected.fromResponse(e.response?.data);
    }
  }

  /// Same contract as [checkIn]: [AttendanceOffline] for transport failures,
  /// [AttendanceRejected] for server rejections.
  Future<AttendanceResult> checkOut({
    required List<double> embedding,
    required Map<String, Object> liveness,
    required String deviceId,
    required bool compromised,
    String? integrityToken,
    CancelToken? cancelToken,
  }) async {
    try {
      final Response res = await _dio.post(
        '/attendance/check-out',
        data: await _signals(embedding: embedding, liveness: liveness, deviceId: deviceId, compromised: compromised, integrityToken: integrityToken),
        cancelToken: cancelToken,
      );
      return AttendanceResult.fromCheckOut(Map<String, dynamic>.from(res.data as Map));
    } on DioException catch (e) {
      if (isNetworkError(e) || isRetryableServerError(e)) throw AttendanceOffline(e);
      throw AttendanceRejected.fromResponse(e.response?.data);
    }
  }

  /// Replays queued punches with FRESH signing material.
  ///
  /// Every entry is re-sent through [_signals], minting a new `requestId`,
  /// `requestTimestamp`, and Ed25519 `signature` at flush time — the queued
  /// bytes are never replayed verbatim because the server rejects requests
  /// outside its freshness window (≈5-min clock skew). A flush success
  /// removes the entry; a 4xx validation rejection ALSO removes it (a
  /// rejected punch must not be retried forever — the outcome is reported in
  /// [FlushResult.dropped] with its server reason); only transport-level
  /// failures keep the entry queued.
  ///
  /// Honest scope: entries older than the server freshness windows (request
  /// skew, liveness `completedAt`) will be rejected as
  /// stale on flush. The outbox covers transient blips (basement Wi-Fi,
  /// tunnel dead spots, rush-hour 429s) — not hours-long offline. Stale
  /// rejections surface as drops, never as silent retries.
  Future<FlushResult> flushOutbox({
    required OutboxRepository outbox,
    CancelToken? cancelToken,
  }) async {
    final List<OutboxEntry> pending = await outbox.load();
    final List<OutboxEntry> kept = <OutboxEntry>[];
    var sent = 0;
    var dropped = 0;
    final List<String?> dropReasons = <String?>[];
    for (final OutboxEntry entry in pending) {
      final String path = entry.kind == PunchKind.checkIn
          ? '/attendance/check-in'
          : '/attendance/check-out';
      try {
        await _dio.post(
          path,
          data: await _signals(
            embedding: entry.embedding,
            liveness: entry.liveness,
            deviceId: entry.deviceId,
            compromised: entry.compromised,
            integrityToken: entry.integrityToken,
          ),
          cancelToken: cancelToken,
        );
        sent++;
      } on DioException catch (e) {
        // Final verdicts (validation rejections) are recorded and dropped.
        // 429/5xx carry no verdict — the entry stays queued for a later
        // flush. Cancellation and transport failures likewise stay queued.
        if (e.response != null && !isRetryableServerError(e)) {
          // Server saw and rejected the punch: record the outcome, drop it.
          dropped++;
          dropReasons.add(AttendanceRejected.fromResponse(e.response?.data).reason);
        } else {
          // Transport failure, cancel, or busy/broken server: keep queued.
          kept.add(entry);
        }
      }
    }
    await outbox.replaceAll(kept);
    return FlushResult(
      sent: sent,
      dropped: dropped,
      pending: kept.length,
      dropReasons: dropReasons,
    );
  }

  /// STEP 14 — own attendance history (paginated, filterable).
  Future<AttendanceHistoryPage> myHistory({
    int page = 1,
    String? checkInStatus,
    String? from,
    String? to,
  }) async {
    final query = toHistoryQueryString(
      page: page,
      checkInStatus: checkInStatus,
      from: from,
      to: to,
    );
    final Response res = await _dio.get('/attendance/me$query');
    return AttendanceHistoryPage.fromJson(Map<String, dynamic>.from(res.data as Map));
  }
}

class AttendanceRejected implements Exception {
  AttendanceRejected(this.reason);
  final String? reason;

  factory AttendanceRejected.fromResponse(Object? data) {
    final String? reason = data is Map ? data['reason'] as String? : null;
    return AttendanceRejected(reason);
  }

  String get message => attendanceRejectMessage(reason);
}

/// Transport-level failure: the punch never reached the server (no HTTP
/// response), so the caller may queue it in the outbox for a later flush.
/// Distinct from [AttendanceRejected], which means the server saw the punch
/// and refused it — those must keep their current error behavior.
class AttendanceOffline implements Exception {
  AttendanceOffline([this.cause]);
  final Object? cause;
}

/// Outcome of [AttendanceRepository.flushOutbox].
class FlushResult {
  FlushResult({
    required this.sent,
    required this.dropped,
    required this.pending,
    this.dropReasons = const <String?>[],
  });

  /// Entries accepted by the server and removed from the outbox.
  final int sent;

  /// Entries the server rejected (4xx) — recorded with their reason and
  /// removed so they are never retried.
  final int dropped;

  /// Entries still queued after the flush (transport failures, busy/broken
  /// server, or cancelled flush).
  final int pending;

  /// Server `reason` codes for the dropped entries, in flush order.
  final List<String?> dropReasons;
}
