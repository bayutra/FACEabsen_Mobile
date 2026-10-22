import 'package:dio/dio.dart';

import '../domain/handover_models.dart';

class HandoverRepository {
  HandoverRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<Handover>> list({String? status}) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/handovers',
      queryParameters: <String, dynamic>{
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    final Object? data = res.data;
    if (data is! List) return const <Handover>[];
    return data
        .whereType<Map<dynamic, dynamic>>()
        .map((Map<dynamic, dynamic> e) => Handover.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Handover> create({
    required String title,
    String? patientSummary,
    String? pendingTasks,
    String? medications,
    String? incidents,
    String? notes,
    String? toEmployeeId,
  }) async {
    final Response<dynamic> res = await _dio.post<dynamic>(
      '/handovers',
      data: <String, dynamic>{
        'title': title.trim(),
        if (patientSummary != null && patientSummary.trim().isNotEmpty)
          'patientSummary': patientSummary.trim(),
        if (pendingTasks != null && pendingTasks.trim().isNotEmpty)
          'pendingTasks': pendingTasks.trim(),
        if (medications != null && medications.trim().isNotEmpty)
          'medications': medications.trim(),
        if (incidents != null && incidents.trim().isNotEmpty)
          'incidents': incidents.trim(),
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        if (toEmployeeId != null && toEmployeeId.isNotEmpty)
          'toEmployeeId': toEmployeeId,
      },
    );
    return Handover.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<Handover> acknowledge(String id, {String? note}) async {
    final Response<dynamic> res = await _dio.post<dynamic>(
      '/handovers/$id/acknowledge',
      data: <String, dynamic>{
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
    return Handover.fromJson(Map<String, dynamic>.from(res.data as Map));
  }
}
