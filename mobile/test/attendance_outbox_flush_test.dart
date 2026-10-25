import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/core/crypto/device_keys.dart';
import 'package:face_absen_mobile/features/attendance/data/attendance_repository.dart';
import 'package:face_absen_mobile/features/attendance/data/outbox_repository.dart';
import 'package:face_absen_mobile/features/attendance/data/punch_models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

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
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType]
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

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
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType]
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

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

class _Harness {
  _Harness(this.repo, this.store);

  final AttendanceRepository repo;
  final FakeStore store;
}

Future<_Harness> _repoWithSeed(Dio dio) async {
  final FakeStore store = FakeStore();
  final pair = await DeviceKeys.generate();
  await store.writePrivateSeed(await DeviceKeys.exportSeedBase64(pair));
  await store.writeNoncePool(List<String>.generate(10, (int i) => 'n$i'));
  return _Harness(AttendanceRepository(dio: dio, store: store), store);
}

Map<String, Object> _passiveLiveness() => <String, Object>{
      'passed': true,
      'mode': 'passive',
      'completedAt': '2026-10-07T07:00:00.000Z',
      'score': 1.0,
      'padScore': 0.82,
    };

OutboxEntry _queued({
  PunchKind kind = PunchKind.checkIn,
  String requestId = 'r-queued',
}) =>
    OutboxEntry(
      kind: kind,
      payload: <String, Object?>{
        'deviceId': 'd1',
        'faceEmbedding': List<double>.filled(192, 0.1),
        'liveness': _passiveLiveness(),
        'requestId': requestId,
        'captureAt': '2026-10-07T07:00:00.000Z',
        'queuedAt': '2026-10-07T07:05:00.000Z',
        'challengeNonce': 'nonce-x',
        'signatureVersion': 'v1',
        'signature': 'sig-$requestId',
        'deviceCompromised': false,
      },
      requestId: requestId,
      captureAt: DateTime.parse('2026-10-07T07:00:00.000Z'),
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
      expect(AttendanceRepository.isNetworkError(err(DioExceptionType.cancel)),
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
      final _Harness h = await _repoWithSeed(dio);
      final AttendanceRepository repo = h.repo;

      await repo.checkIn(
        embedding: List<double>.filled(192, 0.1),
        liveness: _passiveLiveness(),
        deviceId: 'd1',
        compromised: false,
      );
      dio.httpClientAdapter = _ThrowAdapter(DioExceptionType.connectionError);
      PreparedPunch? prepared;
      try {
        await repo.checkIn(
          embedding: List<double>.filled(192, 0.1),
          liveness: _passiveLiveness(),
          deviceId: 'd1',
          compromised: false,
        );
        fail('expected AttendanceOffline');
      } on AttendanceOffline catch (e) {
        prepared = e.prepared;
        expect(prepared, isNotNull);
        final PreparedPunch nonNullPrepared = prepared!;
        expect(nonNullPrepared.payload['queuedAt'], isNotNull);
        await repo.outbox().save(OutboxEntry.fromPrepared(nonNullPrepared));
      }
      expect(await repo.outbox().count(), 1);
      final OutboxEntry stored = (await repo.outbox().load()).single;
      final Object? storedSignature = stored.payload['signature'];
      expect(stored.requestId, prepared.requestId);

      final _CapturingAdapter flushed = _CapturingAdapter();
      dio.httpClientAdapter = flushed;
      final FlushResult result = await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 1);
      expect(result.dropped, 0);
      expect(result.pending, 0);
      expect(await repo.outbox().count(), 0);
      final String idB = flushed.bodies.single['requestId'] as String;
      expect(idB, prepared.requestId);
      expect(flushed.bodies.single['captureAt'], stored.captureAt.toIso8601String());
      expect(flushed.bodies.single['signature'], storedSignature);
      expect(flushed.bodies.single['signatureVersion'], 'v1');
      expect(flushed.bodies.single.containsKey('requestTimestamp'), isFalse);
    });

    test('setiap entry flush mendapat requestId unik + path sesuai kind',
        () async {
      final Dio dio = _dio();
      final _CapturingAdapter cap = _CapturingAdapter();
      dio.httpClientAdapter = cap;
      final _Harness h = await _repoWithSeed(dio);
      final AttendanceRepository repo = h.repo;

      await repo.outbox().save(
          _queued(kind: PunchKind.checkIn, requestId: 'r-in'));
      await repo.outbox().save(
          _queued(kind: PunchKind.checkOut, requestId: 'r-out'));
      final FlushResult result = await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 2);
      expect(result.pending, 0);
      expect(cap.bodies, hasLength(2));
      final List<Object?> ids =
          cap.bodies.map((b) => b['requestId']).toList();
      expect(ids, <Object?>['r-in', 'r-out']);
      expect(
          cap.paths, <String>['/attendance/check-in', '/attendance/check-out']);
    });

    test('422 definitif menjadi needsAction dan tidak dibuang', () async {
      final Dio dio = _dio();
      dio.httpClientAdapter = _StatusAdapter(422, 'STALE_REQUEST');
      final _Harness h = await _repoWithSeed(dio);
      final AttendanceRepository repo = h.repo;

      await repo.outbox().save(_queued());
      final FlushResult result = await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 0);
      expect(result.dropped, 0);
      expect(result.pending, 1);
      expect(result.needsAction, 1);
      expect(result.dropReasons, <String?>['STALE_REQUEST']);
      expect(await repo.outbox().count(), 1);
      final OutboxEntry kept = (await repo.outbox().load()).single;
      expect(kept.needsAction, isTrue);
      expect(kept.lastError, 'STALE_REQUEST');
    });

    test('connection error saat flush → entry tetap antre', () async {
      final Dio dio = _dio();
      dio.httpClientAdapter = _ThrowAdapter(DioExceptionType.connectionError);
      final _Harness h = await _repoWithSeed(dio);
      final AttendanceRepository repo = h.repo;

      await repo.outbox().save(_queued());
      final FlushResult result = await repo.flushOutbox(outbox: repo.outbox());

      expect(result.sent, 0);
      expect(result.dropped, 0);
      expect(result.pending, 1);
      expect(await repo.outbox().count(), 1);
      expect((await repo.outbox().load()).single.attempts, 1);
    });
  });
}
