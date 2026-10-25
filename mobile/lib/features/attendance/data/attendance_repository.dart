import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:uuid/uuid.dart';

import '../../../core/crypto/device_keys.dart';
import '../../../core/storage/secure_store.dart';
import '../domain/attendance_models.dart';
import 'outbox_repository.dart';
import 'punch_models.dart';
import 'signature_v1.dart';

class AttendanceRepository {
  AttendanceRepository({required Dio dio, required SecureStore store})
      : _dio = dio,
        _store = store;

  final Dio _dio;
  final SecureStore _store;

  OutboxRepository outbox() => OutboxRepository(store: _store);

  static bool isNetworkError(DioException e) {
    if (e.type == DioExceptionType.cancel) return false;
    if (e.response != null) return false;
    return e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.unknown;
  }

  static bool isRetryableServerError(DioException e) {
    if (e.type == DioExceptionType.cancel) return false;
    final int? status = e.response?.statusCode;
    return status == 429 || (status != null && status >= 500);
  }

  @visibleForTesting
  static Map<String, Object?> livenessPayload(Map<String, Object> liveness) {
    final bool passive = liveness['mode'] == 'passive';
    return <String, Object?>{
      'passed': liveness['passed'],
      'completedAt': liveness['completedAt'],
      'score': liveness['score'],
      'mode': passive ? 'passive' : 'active',
      if (!passive) 'challenges': liveness['challenges'],
      if (passive && liveness['padScore'] != null)
        'padScore': liveness['padScore'],
    };
  }

  Future<void> ensureNoncePool() async {
    final List<String>? pool = await _store.readNoncePool();
    if (pool != null && pool.length >= 3) return;
    final String? deviceId = await _store.readDeviceId();
    try {
      final Response res = await _dio.post(
        '/attendance/challenge',
        data: <String, Object?>{'deviceId': deviceId},
      );
      final List<dynamic> nonces = (res.data as Map)['nonces'] as List<dynamic>;
      await _store.writeNoncePool(nonces.cast<String>());
    } catch (_) {
      // biarkan pool apa adanya
    }
  }

  /// Capture is blocked before the scan when there are not enough nonces.
  Future<bool> hasNonceSession() async {
    await ensureNoncePool();
    final List<String>? pool = await _store.readNoncePool();
    return pool != null && pool.length >= 2;
  }

  Future<String> _takeNonce() async {
    final List<String>? pool = await _store.readNoncePool();
    if (pool == null || pool.isEmpty) {
      throw StateError('NONCE_POOL_EMPTY');
    }
    final String nonce = pool.first;
    await _store.writeNoncePool(pool.sublist(1));
    return nonce;
  }

  Future<PreparedPunch> preparePunch({
    required PunchKind kind,
    required List<double> embedding,
    required Map<String, Object> liveness,
    required String deviceId,
    required bool compromised,
    String? integrityToken,
    String? requestId,
    String? captureAt,
    String? queuedAt,
  }) async {
    final String? seed = await _store.readPrivateSeed();
    if (seed == null || seed.isEmpty) {
      throw StateError('Device key missing - register the device first.');
    }
    final pair = await DeviceKeys.importFromSeedBase64(seed);
    final String rid = requestId ?? const Uuid().v4();
    final String cap = captureAt ?? DateTime.now().toUtc().toIso8601String();
    final String? q = queuedAt;
    final String nonce = await _takeNonce();
    final String signature = base64Encode(await DeviceKeys.sign(
      pair,
      utf8.encode(await SignatureV1.message(
        action: kind == PunchKind.checkIn ? 'check-in' : 'check-out',
        deviceId: deviceId,
        requestId: rid,
        captureAt: cap,
        queuedAt: q,
        nonce: nonce,
        embedding: embedding,
        liveness: livenessPayload(liveness),
      )),
    ));
    final Map<String, Object?> payload = <String, Object?>{
      'deviceId': deviceId,
      'faceEmbedding': embedding,
      'liveness': livenessPayload(liveness),
      'requestId': rid,
      'captureAt': cap,
      'signatureVersion': 'v1',
      'challengeNonce': nonce,
      'signature': signature,
      'deviceCompromised': compromised,
      if (integrityToken != null && integrityToken.isNotEmpty)
        'integrityToken': integrityToken,
      if (q != null) 'queuedAt': q,
    };
    return PreparedPunch(
      kind: kind,
      payload: payload,
      requestId: rid,
      captureAt: DateTime.parse(cap).toUtc(),
      queuedAt: q == null ? null : DateTime.parse(q).toUtc(),
    );
  }

  Future<AttendanceResult> checkIn({
    required List<double> embedding,
    required Map<String, Object> liveness,
    required String deviceId,
    required bool compromised,
    String? integrityToken,
    CancelToken? cancelToken,
  }) async {
    await ensureNoncePool();
    final List<String>? pool = await _store.readNoncePool();
    if (pool == null || pool.length < 2) {
      throw StateError('NONCE_POOL_LOW');
    }
    PreparedPunch prepared = await preparePunch(
      kind: PunchKind.checkIn,
      embedding: embedding,
      liveness: liveness,
      deviceId: deviceId,
      compromised: compromised,
      integrityToken: integrityToken,
    );
    try {
      final Response res = await _dio.post(
        '/attendance/check-in',
        data: prepared.payload,
        cancelToken: cancelToken,
      );
      return AttendanceResult.fromCheckIn(
          Map<String, dynamic>.from(res.data as Map));
    } on DioException catch (e) {
      if (isNetworkError(e) || isRetryableServerError(e)) {
        PreparedPunch? queued;
        try {
          queued = await preparePunch(
            kind: PunchKind.checkIn,
            embedding: embedding,
            liveness: liveness,
            deviceId: deviceId,
            compromised: compromised,
            integrityToken: integrityToken,
            requestId: prepared.requestId,
            captureAt: prepared.captureAt.toUtc().toIso8601String(),
            queuedAt: DateTime.now().toUtc().toIso8601String(),
          );
        } catch (_) {
          queued = null;
        }
        throw AttendanceOffline(prepared: queued, cause: e);
      }
      throw AttendanceRejected.fromResponse(e.response?.data);
    }
  }

  Future<AttendanceResult> checkOut({
    required List<double> embedding,
    required Map<String, Object> liveness,
    required String deviceId,
    required bool compromised,
    String? integrityToken,
    CancelToken? cancelToken,
  }) async {
    await ensureNoncePool();
    final List<String>? pool = await _store.readNoncePool();
    if (pool == null || pool.length < 2) {
      throw StateError('NONCE_POOL_LOW');
    }
    PreparedPunch prepared = await preparePunch(
      kind: PunchKind.checkOut,
      embedding: embedding,
      liveness: liveness,
      deviceId: deviceId,
      compromised: compromised,
      integrityToken: integrityToken,
    );
    try {
      final Response res = await _dio.post(
        '/attendance/check-out',
        data: prepared.payload,
        cancelToken: cancelToken,
      );
      return AttendanceResult.fromCheckOut(
          Map<String, dynamic>.from(res.data as Map));
    } on DioException catch (e) {
      if (isNetworkError(e) || isRetryableServerError(e)) {
        PreparedPunch? queued;
        try {
          queued = await preparePunch(
            kind: PunchKind.checkOut,
            embedding: embedding,
            liveness: liveness,
            deviceId: deviceId,
            compromised: compromised,
            integrityToken: integrityToken,
            requestId: prepared.requestId,
            captureAt: prepared.captureAt.toUtc().toIso8601String(),
            queuedAt: DateTime.now().toUtc().toIso8601String(),
          );
        } catch (_) {
          queued = null;
        }
        throw AttendanceOffline(prepared: queued, cause: e);
      }
      throw AttendanceRejected.fromResponse(e.response?.data);
    }
  }

  Future<FlushResult> flushOutbox({
    required OutboxRepository outbox,
    CancelToken? cancelToken,
  }) async {
    final List<OutboxEntry> pending = await outbox.load();
    final List<OutboxEntry> kept = <OutboxEntry>[];
    var sent = 0;
    var needsAction = 0;
    final List<String?> dropReasons = <String?>[];
    for (final OutboxEntry entry in pending) {
      if (entry.needsAction) {
        kept.add(entry);
        continue;
      }
      final String path = entry.kind == PunchKind.checkIn
          ? '/attendance/check-in'
          : '/attendance/check-out';
      try {
        await _dio.post(
          path,
          data: entry.payload,
          cancelToken: cancelToken,
        );
        sent++;
      } on DioException catch (e) {
        if (e.response != null && !isRetryableServerError(e)) {
          entry.needsAction = true;
          entry.lastError =
              AttendanceRejected.fromResponse(e.response?.data).reason;
          kept.add(entry);
          needsAction++;
          dropReasons.add(entry.lastError);
        } else {
          entry.attempts += 1;
          if (entry.attempts >= 5) {
            entry.needsAction = true;
            entry.lastError = 'MAX_ATTEMPTS';
            needsAction++;
          }
          kept.add(entry);
        }
      }
    }
    await outbox.replaceAll(kept);
    return FlushResult(
      sent: sent,
      dropped: 0,
      pending: kept.length,
      dropReasons: dropReasons,
      needsAction: needsAction,
    );
  }

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
    return AttendanceHistoryPage.fromJson(
        Map<String, dynamic>.from(res.data as Map));
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

class FlushResult {
  FlushResult({
    required this.sent,
    required this.dropped,
    required this.pending,
    this.dropReasons = const <String?>[],
    this.needsAction = 0,
  });

  final int sent;
  final int dropped;
  final int pending;
  final List<String?> dropReasons;
  final int needsAction;
}