import 'package:dio/dio.dart';

import '../domain/device_change_admin_models.dart';

/// Endpoint antrean penggantian perangkat.
///
/// Backend: `GET /device-change` (ADMIN / SUPER_ADMIN),
/// `POST /device-change/:id/approve`, `POST /device-change/:id/reject`.
class DeviceChangeAdminRepository {
  DeviceChangeAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<AdminDeviceChange>> list({String? status}) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/device-change',
      queryParameters: <String, dynamic>{
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    final Object? data = res.data;
    if (data is! List) return const <AdminDeviceChange>[];
    return data
        .whereType<Map<dynamic, dynamic>>()
        .map(
          (Map<dynamic, dynamic> e) =>
              AdminDeviceChange.fromJson(Map<String, dynamic>.from(e)),
        )
        .toList();
  }

  Future<void> approve(String id, {String? note}) async {
    await _dio.post<dynamic>(
      '/device-change/$id/approve',
      data: _reviewBody(note),
    );
  }

  Future<void> reject(String id, {String? note}) async {
    await _dio.post<dynamic>(
      '/device-change/$id/reject',
      data: _reviewBody(note),
    );
  }
}

Map<String, dynamic> _reviewBody(String? note) => <String, dynamic>{
  if (note != null && note.trim().isNotEmpty) 'reviewNote': note.trim(),
};
