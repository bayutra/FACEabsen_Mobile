import 'package:dio/dio.dart';

import '../domain/employee_admin_models.dart';

/// Endpoint SDM untuk ADMIN: daftar/kirim karyawan, Unit, nonaktifkan.
class EmployeeAdminRepository {
  EmployeeAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<AdminEmployeePage> list({
    String? search,
    String? status,
    String? departmentId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final Response res = await _dio.get(
      '/employees',
      queryParameters: <String, dynamic>{
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        if (status != null) 'status': status,
        if (departmentId != null) 'departmentId': departmentId,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> body = Map<String, dynamic>.from(res.data as Map);
    final List<dynamic> data = (body['data'] as List?) ?? const <dynamic>[];
    final Map<String, dynamic> pagination =
        (body['pagination'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    return AdminEmployeePage(
      items: data
          .map((dynamic e) => AdminEmployee.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      page: pagination['page'] as int? ?? page,
      totalPages: pagination['totalPages'] as int? ?? 1,
      totalItems: pagination['totalItems'] as int? ?? data.length,
    );
  }

  Future<List<AdminDepartment>> departments() async {
    final Response res = await _dio.get('/departments');
    final List<dynamic> list = res.data as List;
    return list
        .map((dynamic e) => AdminDepartment.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<void> create({
    required String employeeNo,
    required String name,
    required String email,
    required String password,
    String? phone,
    String? position,
    String? departmentId,
    List<String> roles = const <String>['EMPLOYEE'],
  }) async {
    await _dio.post('/employees', data: <String, dynamic>{
      'employeeNo': employeeNo.trim(),
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      if (position != null && position.trim().isNotEmpty) 'position': position.trim(),
      if (departmentId != null && departmentId.isNotEmpty) 'departmentId': departmentId,
      'roles': roles,
    });
  }

  Future<void> update(
    String id, {
    String? name,
    String? email,
    String? phone,
    String? position,
    String? departmentId,
  }) async {
    await _dio.patch('/employees/$id', data: <String, dynamic>{
      if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
      if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      if (phone != null) 'phone': phone.trim(),
      if (position != null) 'position': position.trim(),
      if (departmentId != null && departmentId.isNotEmpty) 'departmentId': departmentId,
    });
  }

  /// Nonaktifkan karyawan: login dimatikan, riwayat tetap tersimpan.
  Future<void> deactivate(String id) async {
    await _dio.post('/employees/$id/deactivate');
  }
}
