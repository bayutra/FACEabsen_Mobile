import 'package:dio/dio.dart';

import '../domain/audit_admin_models.dart';

class AuditAdminRepository {
  AuditAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<String>> actions() async {
    final Response res = await _dio.get('/audit/actions');
    final List<dynamic> list = res.data as List? ?? const <dynamic>[];
    return list.map((dynamic e) => e.toString()).toList();
  }

  Future<AdminAuditPage> list({
    String? action,
    String? actorEmail,
    String? result,
    String? from,
    String? to,
    bool? security,
    int page = 1,
    int pageSize = 20,
  }) async {
    final Response res = await _dio.get(
      '/audit',
      queryParameters: <String, dynamic>{
        if (action != null && action.isNotEmpty) 'action': action,
        if (actorEmail != null && actorEmail.trim().isNotEmpty)
          'actorEmail': actorEmail.trim(),
        if (result != null && result.isNotEmpty) 'result': result,
        if (from != null && from.isNotEmpty) 'from': from,
        if (to != null && to.isNotEmpty) 'to': to,
        if (security != null) 'security': security,
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
    return AdminAuditPage(
      items: data
          .map((dynamic e) =>
              AdminAuditLog.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      page: pagination['page'] as int? ?? page,
      totalPages: pagination['totalPages'] as int? ?? 1,
      totalItems: pagination['totalItems'] as int? ?? data.length,
    );
  }
}
