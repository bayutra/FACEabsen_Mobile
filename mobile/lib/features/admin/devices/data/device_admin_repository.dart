import 'package:dio/dio.dart';

import '../domain/device_admin_models.dart';

class DeviceAdminRepository {
  DeviceAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<AdminDevicePage> list({
    String? status,
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    final Response res = await _dio.get(
      '/devices',
      queryParameters: <String, dynamic>{
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> body =
        Map<String, dynamic>.from(res.data as Map);
    final List<dynamic> data = (body['data'] as List?) ?? const <dynamic>[];
    final Map<String, dynamic> pagination =
        (body['pagination'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    return AdminDevicePage(
      items: data
          .map((dynamic e) =>
              AdminDevice.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      page: pagination['page'] as int? ?? page,
      totalPages: pagination['totalPages'] as int? ?? 1,
      totalItems: pagination['totalItems'] as int? ?? data.length,
    );
  }

  Future<void> activate(String id) async {
    await _dio.post('/devices/$id/activate', data: <String, dynamic>{});
  }

  Future<void> revoke(String id, {String? reason}) async {
    await _dio.post(
      '/devices/$id/revoke',
      data: <String, dynamic>{
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
  }

  Future<void> markLost(String id) async {
    await _dio.post('/devices/$id/mark-lost');
  }
}
