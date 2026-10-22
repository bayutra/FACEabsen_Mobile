import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/features/face/data/face_detector.dart';
import 'package:face_absen_mobile/features/face/data/face_embedder.dart';
import 'package:face_absen_mobile/features/face/data/face_repository.dart';
import 'package:face_absen_mobile/features/face/domain/privacy_notice.dart';
import 'package:flutter_test/flutter_test.dart';

class _ConsentCapture implements HttpClientAdapter {
  Map<String, dynamic>? lastPost;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path.contains('/privacy/consent') && options.data is Map) {
      lastPost = Map<String, dynamic>.from(options.data as Map);
    }
    return ResponseBody.fromString(
      jsonEncode(<String, dynamic>{'ok': true}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType]
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

FaceRepository _repo(Dio dio) => FaceRepository(
      dio: dio,
      detector: FaceDetectorService(),
      embedder: FaceEmbedder(),
    );

void main() {
  test('fallback notice is versioned and non-empty', () {
    expect(PrivacyNotice.fallback.version,
        matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
    expect(PrivacyNotice.fallback.title.isNotEmpty, isTrue);
    expect(PrivacyNotice.fallback.body.isNotEmpty, isTrue);
  });

  test('fromJson falls back gracefully', () {
    final n = PrivacyNotice.fromJson({
      'body': ['a', 'b']
    });
    expect(n.lines, ['a', 'b']);
    expect(n.version, PrivacyNotice.fallback.version);
  });

  test('ensureConsent threads the notice version the user read', () async {
    final Dio dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));
    final _ConsentCapture cap = _ConsentCapture();
    dio.httpClientAdapter = cap;
    await _repo(dio).ensureConsent(noticeVersion: '2026-10-01');
    expect(cap.lastPost, isNotNull);
    expect(cap.lastPost!['purpose'], 'BIOMETRIC_ATTENDANCE');
    expect(cap.lastPost!['granted'], isTrue);
    expect(cap.lastPost!['version'], '2026-10-01');
  });

  test('ensureConsent omits version when unread (server falls back)', () async {
    final Dio dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));
    final _ConsentCapture cap = _ConsentCapture();
    dio.httpClientAdapter = cap;
    await _repo(dio).ensureConsent();
    expect(cap.lastPost, isNotNull);
    expect(cap.lastPost!.containsKey('version'), isFalse);
  });
}
