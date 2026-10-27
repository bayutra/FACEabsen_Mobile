import 'package:dio/dio.dart';

/// Endpoint token FCM milik perangkat yang sedang login.
class PushRepository {
  PushRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<void> registerToken({
    required String token,
    required String installationId,
  }) async {
    await _dio.post(
      '/push/tokens',
      data: <String, String>{
        'token': token,
        'installationId': installationId,
      },
    );
  }

  Future<void> unregisterToken(String token) async {
    await _dio.delete('/push/tokens/${Uri.encodeComponent(token)}');
  }
}
