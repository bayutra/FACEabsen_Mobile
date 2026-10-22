import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:uuid/uuid.dart';

import '../../../core/crypto/device_keys.dart';
import '../../../core/storage/secure_store.dart';
import '../domain/attendance_models.dart';
import 'outbox_repository.dart';

class AttendanceRepository {
  AttendanceRepository({required Dio dio, required SecureStore store})
      : _dio = dio,
        _store = store;

  final Dio _dio;
  final SecureStore _store;

  static String signMessage(String requestId, String requestTimestamp) =>
      '$requestId.$requestTimestamp';

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
      if (integrityToken != null && integrityToken.isNotEmpty)
        'integrityToken': integrityToken,
    };
  }

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
        data: await _signals(
            embedding: embedding,
            liveness: liveness,
            deviceId: deviceId,
            compromised: compromised,
            integrityToken: integrityToken),
        cancelToken: cancelToken,
      );
      return AttendanceResult.fromCheckIn(
          Map<String, dynamic>.from(res.data as Map));
    } on DioException catch (e) {
      if (isNetworkError(e) || isRetryableServerError(e)) {
        throw AttendanceOffline(e);
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
    try {
      final Response res = await _dio.post(
        '/attendance/check-out',
        data: await _signals(
            embedding: embedding,
            liveness: liveness,
            deviceId: deviceId,
            compromised: compromised,
            integrityToken: integrityToken),
        cancelToken: cancelToken,
      );
      return AttendanceResult.fromCheckOut(
          Map<String, dynamic>.from(res.data as Map));
    } on DioException catch (e) {
      if (isNetworkError(e) || isRetryableServerError(e)) {
        throw AttendanceOffline(e);
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
        if (e.response != null && !isRetryableServerError(e)) {
          dropped++;
          dropReasons
              .add(AttendanceRejected.fromResponse(e.response?.data).reason);
        } else {
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

class AttendanceOffline implements Exception {
  AttendanceOffline([this.cause]);
  final Object? cause;
}

class FlushResult {
  FlushResult({
    required this.sent,
    required this.dropped,
    required this.pending,
    this.dropReasons = const <String?>[],
  });

  final int sent;

  final int dropped;

  final int pending;

  final List<String?> dropReasons;
}
