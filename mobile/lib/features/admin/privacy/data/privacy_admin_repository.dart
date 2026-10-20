import 'package:dio/dio.dart';

import '../domain/privacy_admin_models.dart';

/// Endpoint privasi & retensi untuk SUPER_ADMIN.
///
/// Backend: GET /privacy/notice ({version, lang, title, body[]}),
/// POST /privacy/retention/run (menjalankan pembersihan retensi).
class PrivacyAdminRepository {
  PrivacyAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<PrivacyNotice> notice() async {
    final Response res = await _dio.get('/privacy/notice');
    final Map<String, dynamic> body = Map<String, dynamic>.from(res.data as Map);
    return PrivacyNotice.fromJson(body);
  }

  /// Menjalankan pembersihan data melewati masa retensi.
  /// Mengembalikan respons mentah sebagai map untuk ditampilkan snackbar.
  Future<Map<String, dynamic>> runRetention() async {
    final Response res = await _dio.post('/privacy/retention/run');
    final Object? data = res.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{'result': data.toString()};
  }
}
