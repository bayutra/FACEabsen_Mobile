import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/core/crypto/device_keys.dart';
import 'package:face_absen_mobile/core/network/api_client.dart';
import 'package:face_absen_mobile/features/attendance/data/attendance_repository.dart';
import 'package:face_absen_mobile/features/attendance/data/outbox_repository.dart';
import 'package:face_absen_mobile/features/location/domain/geo_models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

/// Answers GET /protected with a scripted sequence of 429/200 responses.
class _RateLimitAdapter implements HttpClientAdapter {
  _RateLimitAdapter(this.script);

  /// (status, retryAfterHeader) per call, in order; repeats the last entry.
  final List<(int, String?)> script;
  int hits = 0;

  Map<String, List<String>> get _json => {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    hits++;
    final (int status, String? retryAfter) =
        hits <= script.length ? script[hits - 1] : script.last;
    final Map<String, List<String>> headers = Map.of(_json);
    if (retryAfter != null) headers['retry-after'] = [retryAfter];
    return ResponseBody.fromString(
      jsonEncode({'ok': status == 200}),
      status,
      headers: headers,
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Answers every POST with [status] (+ optional retry-after).
class _PostStatusAdapter implements HttpClientAdapter {
  _PostStatusAdapter(this.status, {this.retryAfter});

  final int status;
  final String? retryAfter;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final Map<String, List<String>> headers = {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    };
    final String? ra = retryAfter;
    if (ra != null) headers['retry-after'] = [ra];
    return ResponseBody.fromString(
      jsonEncode({'reason': 'X'}),
      status,
      headers: headers,
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

Dio _dio() => Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));

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

OutboxEntry _queued() => OutboxEntry(
      kind: PunchKind.checkIn,
      fix: _fix(),
      embedding: List<double>.filled(192, 0.1),
      liveness: _passiveLiveness(),
      deviceId: 'd1',
      compromised: false,
      queuedAt: DateTime.parse('2026-10-07T07:05:00.000Z'),
    );

void main() {
  group('parseRetryAfter', () {
    test('seconds form, clamped to the cap', () {
      expect(parseRetryAfter('0'), Duration.zero);
      expect(parseRetryAfter('5'), const Duration(seconds: 5));
      expect(parseRetryAfter('120'), const Duration(seconds: 30));
      expect(parseRetryAfter('-3'), Duration.zero);
    });

    test('missing and garbage fall back to 1s (never throws)', () {
      expect(parseRetryAfter(null), const Duration(seconds: 1));
      expect(parseRetryAfter(''), const Duration(seconds: 1));
      expect(parseRetryAfter('soon-ish'), const Duration(seconds: 1));
    });

    test('HTTP-date form honors the delta', () {
      final DateTime now = DateTime.parse('2026-10-07T07:00:00.000Z');
      expect(parseRetryAfter('Tue, 07 Oct 2026 07:00:03 GMT', now: now),
          const Duration(seconds: 3));
      expect(parseRetryAfter('Tue, 07 Oct 2026 06:59:00 GMT', now: now),
          Duration.zero);
    });
  });

  group('interceptor honors Retry-After once', () {
    test('429 + Retry-After: 0 retries once then succeeds', () async {
      final FakeStore store = FakeStore();
      final Dio dio = createApiClient(store: store);
      final _RateLimitAdapter fake = _RateLimitAdapter([(429, '0'), (200, null)]);
      dio.httpClientAdapter = fake;

      final Response<dynamic> res = await dio.get('/protected');
      expect(res.statusCode, 200);
      expect(fake.hits, 2);
    });

    test('Retry-After beyond the foreground cap propagates immediately', () async {
      final FakeStore store = FakeStore();
      final Dio dio = createApiClient(store: store);
      final _RateLimitAdapter fake = _RateLimitAdapter([(429, '120')]);
      dio.httpClientAdapter = fake;

      final Stopwatch sw = Stopwatch()..start();
      await expectLater(dio.get('/protected'), throwsA(isA<DioException>()));
      sw.stop();
      expect(fake.hits, 1);
      expect(sw.elapsed, lessThan(const Duration(seconds: 4)));
    });

    test('a second consecutive 429 is not retried again', () async {
      final FakeStore store = FakeStore();
      final Dio dio = createApiClient(store: store);
      final _RateLimitAdapter fake = _RateLimitAdapter([(429, '0')]);
      dio.httpClientAdapter = fake;

      await expectLater(dio.get('/protected'), throwsA(isA<DioException>()));
      // First 429 waited + retried (hit 2), which 429s again → propagates.
      expect(fake.hits, 2);
    });
  });

  group('punch mapping + outbox retention', () {
    Future<AttendanceRepository> repoWith(int status, {String? retryAfter}) async {
      final Dio dio = _dio();
      dio.httpClientAdapter =
          _PostStatusAdapter(status, retryAfter: retryAfter);
      return _repoWithSeed(dio);
    }

    Future<void> punch(AttendanceRepository repo) => repo.checkIn(
          fix: _fix(),
          embedding: List<double>.filled(192, 0.1),
          liveness: _passiveLiveness(),
          deviceId: 'd1',
          compromised: false,
        );

    test('429 and 500 throw AttendanceOffline (queueable), 422 rejects', () async {
      await expectLater(
          punch(await repoWith(429)), throwsA(isA<AttendanceOffline>()));
      await expectLater(
          punch(await repoWith(500)), throwsA(isA<AttendanceOffline>()));
      await expectLater(
          punch(await repoWith(422)), throwsA(isA<AttendanceRejected>()));
    });

    test('flush keeps 429/500 queued, drops 422', () async {
      final FakeStore store = FakeStore();
      final pair = await DeviceKeys.generate();
      await store.writePrivateSeed(await DeviceKeys.exportSeedBase64(pair));
      final Dio dio = _dio();
      final AttendanceRepository repo =
          AttendanceRepository(dio: dio, store: store);

      dio.httpClientAdapter = _PostStatusAdapter(429);
      await repo.outbox().save(_queued());
      FlushResult r429 = await repo.flushOutbox(outbox: repo.outbox());
      expect((r429.sent, r429.dropped, r429.pending), (0, 0, 1));

      dio.httpClientAdapter = _PostStatusAdapter(500);
      FlushResult r500 = await repo.flushOutbox(outbox: repo.outbox());
      expect((r500.sent, r500.dropped, r500.pending), (0, 0, 1));

      dio.httpClientAdapter = _PostStatusAdapter(422);
      FlushResult r422 = await repo.flushOutbox(outbox: repo.outbox());
      expect((r422.sent, r422.dropped, r422.pending), (0, 1, 0));
      expect(await repo.outbox().count(), 0);
    });
  });
}
