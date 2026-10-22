import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/core/network/api_client.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

class RefreshFakeAdapter implements HttpClientAdapter {
  RefreshFakeAdapter({
    this.failRefresh = false,
    this.refreshDelay = const Duration(milliseconds: 60),
  });

  int refreshCount = 0;
  final bool failRefresh;
  final Duration refreshDelay;
  final List<String?> successfulAuthHeaders = [];

  Map<String, List<String>> get _json => {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path.contains('/auth/refresh')) {
      refreshCount++;
      await Future.delayed(refreshDelay);
      if (failRefresh) {
        return ResponseBody.fromString(
          jsonEncode({'message': 'invalid refresh'}),
          401,
          headers: _json,
        );
      }
      return ResponseBody.fromString(
        jsonEncode(
            {'accessToken': 'new-access', 'refreshToken': 'new-refresh'}),
        200,
        headers: _json,
      );
    }
    final Object? auth = options.headers['Authorization'];
    if (auth == 'Bearer new-access') {
      successfulAuthHeaders.add(auth as String?);
      return ResponseBody.fromString(
        jsonEncode({'ok': true}),
        200,
        headers: _json,
      );
    }
    return ResponseBody.fromString(
      jsonEncode({'message': 'unauthorized'}),
      401,
      headers: _json,
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('api_client single-flight refresh', () {
    test('5 concurrent 401s share ONE /auth/refresh call', () async {
      final FakeStore store = FakeStore();
      await store.writeTokens('expired-access', 'valid-refresh');

      final Dio dio = createApiClient(store: store);
      final RefreshFakeAdapter fake = RefreshFakeAdapter();
      dio.httpClientAdapter = fake;

      final List<Response<dynamic>> results = await Future.wait(
        List.generate(5, (_) => dio.get('/protected')),
      );

      for (final Response<dynamic> r in results) {
        expect(r.statusCode, 200);
        expect((r.data as Map)['ok'], isTrue);
      }
      expect(fake.refreshCount, 1,
          reason:
              'rotation invalidates the old refresh; N calls must share one');
      expect(fake.successfulAuthHeaders, hasLength(5));
      for (final String? h in fake.successfulAuthHeaders) {
        expect(h, 'Bearer new-access');
      }
      expect(await store.readAccessToken(), 'new-access');
      expect(await store.readRefreshToken(), 'new-refresh');
    });

    test('refresh failure clears local tokens (fail closed)', () async {
      final FakeStore store = FakeStore();
      await store.writeTokens('expired-access', 'bad-refresh');

      final Dio dio = createApiClient(store: store);
      final RefreshFakeAdapter fake = RefreshFakeAdapter(failRefresh: true);
      dio.httpClientAdapter = fake;

      await expectLater(
        dio.get('/protected'),
        throwsA(isA<DioException>().having(
          (e) => e.response?.statusCode,
          'status',
          401,
        )),
      );
      expect(fake.refreshCount, 1);
      expect(await store.readAccessToken(), isNull);
      expect(await store.readRefreshToken(), isNull);
    });
  });
}
