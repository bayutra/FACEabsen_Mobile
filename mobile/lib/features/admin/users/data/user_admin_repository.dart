import 'package:dio/dio.dart';

import '../domain/user_admin_models.dart';





class UserAdminRepository {
  UserAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<AdminUserPage> list({
    String? search,
    String? role,
    bool? isActive,
    int page = 1,
    int pageSize = 20,
  }) async {
    final Response res = await _dio.get(
      '/users',
      queryParameters: <String, dynamic>{
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        if (role != null && role.isNotEmpty) 'role': role,
        if (isActive != null) 'isActive': isActive,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> body = Map<String, dynamic>.from(res.data as Map);
    final List<dynamic> data = (body['data'] as List?) ?? const <dynamic>[];
    final Map<String, dynamic> pagination =
        (body['pagination'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    return AdminUserPage(
      items: data
          .map((dynamic e) => AdminUser.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      page: pagination['page'] as int? ?? page,
      totalPages: pagination['totalPages'] as int? ?? 1,
      totalItems: pagination['totalItems'] as int? ?? data.length,
    );
  }

  Future<void> create({
    required String email,
    required String password,
    required List<String> roles,
  }) async {
    await _dio.post(
      '/users',
      data: <String, dynamic>{
        'email': email.trim(),
        'password': password,
        'roles': roles,
      },
    );
  }

  
  Future<void> update(
    String id, {
    List<String>? roles,
    bool? isActive,
  }) async {
    await _dio.patch(
      '/users/$id',
      data: <String, dynamic>{
        if (roles != null) 'roles': roles,
        if (isActive != null) 'isActive': isActive,
      },
    );
  }

  Future<void> resetPassword(String id, {required String password}) async {
    await _dio.post(
      '/users/$id/reset-password',
      data: <String, dynamic>{'password': password},
    );
  }
}
