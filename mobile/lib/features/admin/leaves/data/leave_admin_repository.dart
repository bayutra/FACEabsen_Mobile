import 'package:dio/dio.dart';

import '../domain/leave_admin_models.dart';





class LeaveAdminRepository {
  LeaveAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<AdminLeave>> list({
    String? status,
    String? employeeId,
    DateTime? from,
    DateTime? to,
  }) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/leaves',
      queryParameters: <String, dynamic>{
        if (status != null && status.isNotEmpty) 'status': status,
        if (employeeId != null && employeeId.trim().isNotEmpty)
          'employeeId': employeeId.trim(),
        if (from != null) 'from': _dateParam(from),
        if (to != null) 'to': _dateParam(to),
      },
    );
    final Object? data = res.data;
    if (data is! List) return const <AdminLeave>[];
    return data
        .whereType<Map<dynamic, dynamic>>()
        .map(
          (Map<dynamic, dynamic> e) =>
              AdminLeave.fromJson(Map<String, dynamic>.from(e)),
        )
        .toList();
  }

  Future<void> approve(String id, {String? note}) async {
    await _dio.post<dynamic>(
      '/leaves/$id/approve',
      data: _reviewBody(note),
    );
  }

  Future<void> reject(String id, {String? note}) async {
    await _dio.post<dynamic>(
      '/leaves/$id/reject',
      data: _reviewBody(note),
    );
  }
}

Map<String, dynamic> _reviewBody(String? note) => <String, dynamic>{
  if (note != null && note.trim().isNotEmpty) 'reviewNote': note.trim(),
};

String _dateParam(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';
