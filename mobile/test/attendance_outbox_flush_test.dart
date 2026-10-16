import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/core/crypto/device_keys.dart';
import 'package:face_absen_mobile/features/attendance/data/attendance_repository.dart';
import 'package:face_absen_mobile/features/attendance/data/outbox_repository.dart';
import 'package:face_absen_mobile/features/location/domain/geo_models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

/// Records every POST body; always answers 200 with a minimal check-in shape.
class _CapturingAdapter implements HttpClientAdapter {
  final List<Map<String, dynamic>> bodies = <Map<String, dynamic>>[];
  final List<String> paths = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.path);
    final Object? data = options.data;
    if (data is Map) bodies.add(Map<String, dynamic>.from(data));
    return ResponseBody.fromString(
      jsonEncode(<String, dynamic>{
        'id': 'a1',
        'workDate': '2026-10-07',
        'checkInAt': '2026-10-07T07:00:00.000Z',
      }),
      200,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Answers every POST with [status] + a server `reason` payload.
class _StatusAdapter implements HttpClientAdapter {
  _StatusAdapter(this.status, this.reason);

  final int status;
  final String reason;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      jsonEncode(<String, dynamic>{'reason': reason}),
      status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Fails every POST as if the network is down (no HTTP response).
class _ThrowAdapter implements HttpClientAdapter {
  _ThrowAdapter(this.type);

  final DioExceptionType type;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    throw DioException(requestOptions: options, type: type);
  }

  @override
  void close({bool force = false}) {}
}

Future<AttendanceRepository> _repoWithSeed(Dio dio) async {
  final FakeStore store = FakeStore();
  final pair = await DeviceKeys.generate();
  await store.writePrivateSeed(await DeviceKeys.exportSeedBase64(pair));
  return AttendanceRepository(dio: dio, store: store);
}

GeoFix _fix() => GeoFix(
      latitude: -7.95,
      longitude: 112.61,
      accuracyM: 8,
      timestamp: DateTime.parse('2026-10-07T07:00:00.000Z'),
      isMocked: false,
    );

Map<String, Object> _passiveLiveness() => <String, Object>{
      'passed': true,
      'mode': 'passive',
      'completedAt': '2026-10-07T07:00:00.000Z',
      'score': 1.0,
      'padScore': 0.82,
    };

OutboxEntry _queued({PunchKind kind = PunchKind.checkIn}) => OutboxEntry(
      kind: kind,
      fix: _fix(),
      embedding: List<double>.filled(192, 0.1),
      liveness: _passiveLiveness(),
      deviceId: 'd1',
      compromised: false,
      queuedAt: DateTime.parse('2026-10-07T07:05:00.000Z'),
    );

Dio _dio() => Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));

void main() {
  group('isNetworkError', () {
    DioException err(DioExceptionType type, {int? status}) => DioException(
          requestOptions: RequestOptions(path: '/attendance/check-in'),
          response: status == null
              ? null
              : Response(
                  requestOptions: RequestOptions(path: '/attendance/check-in'),
                  statusCode: status,
                ),
          type: type,
        );

    test('transport failures tanpa response → true', () {
      for (final DioExceptionType t in <DioExceptionType>[
        DioExceptionType.connectionError,
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
        DioExceptionType.unknown,
      ]) {
        expect(AttendanceRepository.isNetworkError(err(t)), isTrue,
            reason: '$t');
      }
    });

    test('cancel dan response server → false', () {
      expect(
          AttendanceRepository.isNetworkError(
              err(DioExceptionType.cancel)),
          isFalse);
      expect(
          AttendanceRepository.isNetworkError(
              err(DioExceptionType.badResponse, status: 422)),
          isFalse);
      expect(
          AttendanceRepository.isNetworkError(
              err(DioExceptionType.badResponse, status: 400)),
          isFalse);
    });
  });

  group('offline punch → queue → flush', () {
    test('gagal offline melempar AttendanceOffline, flush re-signs fresh',
        () async {
      final Dio dio = _dio();
      final _CapturingAdapter baseline = _CapturingAdapter();
      dio.httpClientAdapter = baseline;
      final AttendanceRepository repo = await _repoWithSeed(dio);

      // Baseline: satu punch sukses mencantumkan requestId A.
      await repo.checkIn(
        fix: _fix(),
        embedding: List<double>.filled(192, 0.1),
        liveness: _passiveLiveness(),
        deviceId: 'd1',
        compromised: false,
      );
      final String idA = baseline.bodies.single['requestId'] as String;

      // Outage: punch gagal offline → layar mengantrekan entry.
      dio.httpClientAdapter = _ThrowAdapter(DioExceptionType.connectionError);
      try {
        await repo.checkIn(
          fix: _fix(),
          embedding: List<double>.filled(192, 0.1),
          liveness: _passiveLiveness(),
          deviceId: 'd1',
          compromised: false,
        );
        fail('expected AttendanceOffline');
      } on AttendanceOffline {
        await repo.outbox().save(_queued());
      }
      expect(await repo.outbox().count(), 1);

      // Online lagi: flush mengirim ulang dengan tanda tangan BARU.
      final _CapturingAdapter flushed = _CapturingAdapter();
      dio.httpClientAdapter = flushed;
      final FlushResult result =
          await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 1);
      expect(result.dropped, 0);
      expect(result.pending, 0);
      expect(await repo.outbox().count(), 0);
      final String idB = flushed.bodies.single['requestId'] as String;
      expect(idB, isNot(idA));
      // Timestamp juga fresh (bisa di-parse, bukan bytes antrean lama).
      expect(
          DateTime.tryParse(
              flushed.bodies.single['requestTimestamp'] as String),
          isNotNull);
    });

    test('setiap entry flush mendapat requestId unik + path sesuai kind',
        () async {
      final Dio dio = _dio();
      final _CapturingAdapter cap = _CapturingAdapter();
      dio.httpClientAdapter = cap;
      final AttendanceRepository repo = await _repoWithSeed(dio);

      await repo.outbox().save(_queued(kind: PunchKind.checkIn));
      await repo.outbox().save(_queued(kind: PunchKind.checkOut));
      final FlushResult result =
          await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 2);
      expect(result.pending, 0);
      expect(cap.bodies, hasLength(2));
      final Set<Object?> ids =
          cap.bodies.map((b) => b['requestId']).toSet();
      expect(ids, hasLength(2));
      expect(cap.paths,
          <String>['/attendance/check-in', '/attendance/check-out']);
    });

    test('422 server outcome tercatat lalu entry dibuang (tidak retry)',
        () async {
      final Dio dio = _dio();
      dio.httpClientAdapter = _StatusAdapter(422, 'STALE_REQUEST');
      final AttendanceRepository repo = await _repoWithSeed(dio);

      await repo.outbox().save(_queued());
      final FlushResult result =
          await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 0);
      expect(result.dropped, 1);
      expect(result.pending, 0);
      expect(result.dropReasons, <String?>['STALE_REQUEST']);
      expect(await repo.outbox().count(), 0);
    });

    test('connection error saat flush → entry tetap antre', () async {
      final Dio dio = _dio();
      dio.httpClientAdapter = _ThrowAdapter(DioExceptionType.connectionError);
      final AttendanceRepository repo = await _repoWithSeed(dio);

      await repo.outbox().save(_queued());
      final FlushResult result =
          await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 0);
      expect(result.dropped, 0);
      expect(result.pending, 1);
      expect(await repo.outbox().count(), 1);
    });
  });
}
