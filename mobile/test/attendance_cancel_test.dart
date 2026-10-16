import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/core/crypto/device_keys.dart';
import 'package:face_absen_mobile/features/attendance/data/attendance_repository.dart';
import 'package:face_absen_mobile/features/attendance/domain/attendance_models.dart';
import 'package:face_absen_mobile/features/location/domain/geo_models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

class _HangingAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final Completer<ResponseBody> hang = Completer<ResponseBody>();
    if (cancelFuture == null) return hang.future;
    await Future.any(<Future<void>>[hang.future, cancelFuture]);
    throw DioException(
      requestOptions: options,
      type: DioExceptionType.cancel,
    );
  }

  @override
  void close({bool force = false}) {}
}

class _CapturingAdapter implements HttpClientAdapter {
  Map<String, dynamic>? captured;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final Object? data = options.data;
    if (data is Map) {
      captured = Map<String, dynamic>.from(data);
    }
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

void main() {
  group('attendance cancel plumbing', () {
    test('cancel mid-flight surfaces as AttendanceRejected, never raw DioException', () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));
      dio.httpClientAdapter = _HangingAdapter();
      final AttendanceRepository repo = await _repoWithSeed(dio);

      final CancelToken token = CancelToken();
      final Future<AttendanceResult> flight = repo.checkIn(
        fix: _fix(),
        embedding: List<double>.filled(192, 0.1),
        liveness: _passiveLiveness(),
        deviceId: 'd1',
        compromised: false,
        cancelToken: token,
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
      token.cancel('user cancelled');

      try {
        await flight.timeout(const Duration(seconds: 5));
        fail('expected AttendanceRejected');
      } on AttendanceRejected {
        // Expected: cancellation is a domain failure, never a raw DioException.
      } on DioException catch (e) {
        fail('must never leak DioException (got $e)');
      } on TimeoutException {
        fail('cancel hung: fetch ignored the CancelToken');
      }
    });
  });

  group('attendance wire payload (passive liveness)', () {
    test('POST carries all required server keys; passive omits challenges, keeps padScore', () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));
      final _CapturingAdapter adapter = _CapturingAdapter();
      dio.httpClientAdapter = adapter;
      final AttendanceRepository repo = await _repoWithSeed(dio);

      await repo.checkIn(
        fix: _fix(),
        embedding: List<double>.filled(192, 0.1),
        liveness: _passiveLiveness(),
        deviceId: 'd1',
        compromised: false,
      );

      final Map<String, dynamic>? body = adapter.captured;
      expect(body, isNotNull);
      for (final String k in <String>[
        'deviceId',
        'latitude',
        'longitude',
        'accuracyM',
        'fixTimestamp',
        'isMocked',
        'faceEmbedding',
        'liveness',
        'requestId',
        'requestTimestamp',
        'signature',
        'deviceCompromised',
      ]) {
        expect(body!.containsKey(k), isTrue, reason: 'missing wire key $k');
      }
      final Map liveness = body!['liveness'] as Map;
      expect(liveness['mode'], 'passive');
      expect(liveness.containsKey('challenges'), isFalse);
      expect(liveness['padScore'], 0.82);
    });
  });
}
