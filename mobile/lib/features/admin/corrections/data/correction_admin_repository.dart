import 'package:dio/dio.dart';

import '../domain/correction_admin_models.dart';

class CorrectionAdminRepository {
  CorrectionAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<AdminCorrection>> list(
      {String? status, String? employeeId}) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/corrections',
      queryParameters: <String, dynamic>{
        if (status != null && status.isNotEmpty) 'status': status,
        if (employeeId != null && employeeId.trim().isNotEmpty)
          'employeeId': employeeId.trim(),
      },
    );
    final Object? data = res.data;
    if (data is! List) return const <AdminCorrection>[];
    return data
        .whereType<Map<dynamic, dynamic>>()
        .map(
          (Map<dynamic, dynamic> e) =>
              AdminCorrection.fromJson(Map<String, dynamic>.from(e)),
        )
        .toList();
  }

  Future<void> approve(String id, {String? note}) async {
    await _dio.post<dynamic>(
      '/corrections/$id/approve',
      data: _reviewBody(note),
    );
  }

  Future<void> reject(String id, {String? note}) async {
    await _dio.post<dynamic>(
      '/corrections/$id/reject',
      data: _reviewBody(note),
    );
  }
}

Map<String, dynamic> _reviewBody(String? note) => <String, dynamic>{
      if (note != null && note.trim().isNotEmpty) 'reviewNote': note.trim(),
    };
