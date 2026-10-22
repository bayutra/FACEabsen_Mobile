import 'package:dio/dio.dart';

import '../domain/leave_models.dart';


class LeaveRepository {
  LeaveRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<LeaveItem> create({
    required String type,
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    final Response res = await _dio.post(
      '/leaves',
      data: {'type': type, 'startDate': startDate, 'endDate': endDate, 'reason': reason},
    );
    return LeaveItem.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<List<LeaveItem>> myLeaves() async {
    final Response res = await _dio.get('/leaves/me');
    final List list = res.data as List;
    return list
        .map((e) => LeaveItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<void> cancel(String id) async {
    await _dio.post('/leaves/$id/cancel');
  }
}
