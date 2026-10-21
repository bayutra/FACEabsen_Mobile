import 'package:dio/dio.dart';

/// Model rumah sakit ringkas untuk pemilih master data.
class DepartmentHospital {
  const DepartmentHospital({
    required this.id,
    required this.code,
    required this.name,
  });

  final String id;
  final String code;
  final String name;

  String get label => code.isEmpty ? name : '$code Â· $name';

  factory DepartmentHospital.fromJson(Map<String, dynamic> json) =>
      DepartmentHospital(
        id: _stringOf(json['id']),
        code: _stringOf(json['code']),
        name: _stringOf(json['name'], fallback: 'Tanpa nama'),
      );
}

/// Unit beserta rumah sakit induknya (GET /departments).
class AdminDepartmentItem {
  const AdminDepartmentItem({
    required this.id,
    required this.name,
    required this.hospitalId,
    required this.hospitalName,
    required this.hospitalCode,
  });

  final String id;
  final String name;
  final String hospitalId;
  final String hospitalName;
  final String hospitalCode;

  String get hospitalLabel =>
      hospitalCode.isEmpty ? hospitalName : '$hospitalCode Â· $hospitalName';

  factory AdminDepartmentItem.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> hospital = _mapOf(json['hospital']);
    return AdminDepartmentItem(
      id: _stringOf(json['id']),
      name: _stringOf(json['name'], fallback: 'Tanpa nama'),
      hospitalId: _stringOf(
        json['hospitalId'],
        fallback: _stringOf(hospital['id']),
      ),
      hospitalName: _stringOf(
        hospital['name'],
        fallback: 'Rumah sakit tidak diketahui',
      ),
      hospitalCode: _stringOf(hospital['code']),
    );
  }
}

/// Endpoint master data Unit untuk ADMIN.
///
/// Backend: GET /departments, POST /departments, PATCH /departments/:id,
/// DELETE /departments/:id. Daftar rumah sakit diambil dari GET /hospitals.
class DepartmentAdminRepository {
  DepartmentAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<AdminDepartmentItem>> list() async {
    final Response<dynamic> res = await _dio.get<dynamic>('/departments');
    final Object? data = res.data;
    if (data is! List) return const <AdminDepartmentItem>[];
    final List<AdminDepartmentItem> items = <AdminDepartmentItem>[];
    for (final Object? row in data) {
      if (row is Map) {
        items.add(
          AdminDepartmentItem.fromJson(Map<String, dynamic>.from(row)),
        );
      }
    }
    return items;
  }

  Future<List<DepartmentHospital>> hospitals() async {
    final Response<dynamic> res = await _dio.get<dynamic>('/hospitals');
    final Object? data = res.data;
    if (data is! List) return const <DepartmentHospital>[];
    final List<DepartmentHospital> items = <DepartmentHospital>[];
    for (final Object? row in data) {
      if (row is Map) {
        items.add(DepartmentHospital.fromJson(Map<String, dynamic>.from(row)));
      }
    }
    return items;
  }

  Future<void> create({
    required String hospitalId,
    required String name,
  }) async {
    await _dio.post<dynamic>(
      '/departments',
      data: <String, dynamic>{
        'hospitalId': hospitalId,
        'name': name.trim(),
      },
    );
  }

  Future<void> update(String id, {required String name}) async {
    await _dio.patch<dynamic>(
      '/departments/$id',
      data: <String, dynamic>{'name': name.trim()},
    );
  }

  /// Server menolak (409) bila Unit masih memiliki karyawan.
  Future<void> delete(String id) async {
    await _dio.delete<dynamic>('/departments/$id');
  }
}

Map<String, dynamic> _mapOf(Object? value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

String _stringOf(Object? value, {String fallback = ''}) {
  if (value is String) return value;
  if (value == null) return fallback;
  return value.toString();
}
