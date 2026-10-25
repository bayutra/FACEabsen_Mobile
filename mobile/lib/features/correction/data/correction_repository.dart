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

  Future<void> cancel(String id) async {
    await _dio.post('/corrections/$id/cancel');
  }
}
