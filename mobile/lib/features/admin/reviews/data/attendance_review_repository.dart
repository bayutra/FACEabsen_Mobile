import 'package:dio/dio.dart';

import '../domain/attendance_review_models.dart';




class AttendanceReviewRepository {
  AttendanceReviewRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<AttendanceReviewItem>> list() async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/attendance/review',
      queryParameters: <String, dynamic>{'pageSize': 50},
    );
    final Object? body = res.data;
    final Object? data = body is Map ? body['data'] : body;
    if (data is! List) return const <AttendanceReviewItem>[];
    return data
        .whereType<Map<dynamic, dynamic>>()
        .map(
          (Map<dynamic, dynamic> e) =>
              AttendanceReviewItem.fromJson(Map<String, dynamic>.from(e)),
        )
        .toList();
  }

  Future<void> review(
    String id, {
    required bool approve,
    String? note,
  }) async {
    await _dio.post<dynamic>(
      '/attendance/$id/review',
      data: <String, dynamic>{
        'decision': approve ? 'APPROVE' : 'REJECT',
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }
}
