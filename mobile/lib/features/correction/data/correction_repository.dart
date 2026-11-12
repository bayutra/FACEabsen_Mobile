import 'package:dio/dio.dart';

import '../domain/correction_models.dart';

class CorrectionRepository {
  CorrectionRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<CorrectionItem> create({
    required String attendanceId,
    required String type,
    String? requestedCheckIn,
    String? requestedCheckOut,
    required String reason,
    String? evidenceUrl,
  }) async {
    final Response res = await _dio.post(
      '/corrections',
      data: {
        'attendanceId': attendanceId,
        'type': type,
        if (requestedCheckIn != null) 'requestedCheckIn': requestedCheckIn,
        if (requestedCheckOut != null) 'requestedCheckOut': requestedCheckOut,
        'reason': reason,
        if (evidenceUrl != null && evidenceUrl.isNotEmpty)
          'evidenceUrl': evidenceUrl,
      },
    );
    return CorrectionItem.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<List<CorrectionItem>> myCorrections() async {
    final Response res = await _dio.get('/corrections/me');
    final List list = res.data as List;
    return list
        .map(
            (e) => CorrectionItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  /// Antrian peninjauan untuk Kepala Ruangan / Supervisor
  /// (`correction:approve:team`, scope unit/departemen di backend).
  Future<List<CorrectionItem>> listQueue({String status = 'PENDING'}) async {
    final Response res = await _dio.get(
      '/corrections',
      queryParameters: <String, dynamic>{'status': status},
    );
    final Object? data = res.data;
    if (data is! List) return const <CorrectionItem>[];
    return data
        .whereType<Map<dynamic, dynamic>>()
        .map((Map<dynamic, dynamic> e) =>
            CorrectionItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> approve(String id, {String? note}) async {
    await _dio.post(
      '/corrections/$id/approve',
      data: <String, dynamic>{
        if (note != null && note.trim().isNotEmpty) 'reviewNote': note.trim(),
      },
    );
  }

  Future<void> reject(String id, {String? note}) async {
    await _dio.post(
      '/corrections/$id/reject',
      data: <String, dynamic>{
        if (note != null && note.trim().isNotEmpty) 'reviewNote': note.trim(),
      },
    );
  }

  Future<void> cancel(String id) async {
    await _dio.post('/corrections/$id/cancel');
  }
}
