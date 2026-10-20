import 'package:dio/dio.dart';

/// Rumah sakit ringkas untuk pemilih pada formulir shift.
class ShiftHospital {
  const ShiftHospital({
    required this.id,
    required this.code,
    required this.name,
  });

  final String id;
  final String code;
  final String name;

  String get label => code.isEmpty ? name : '$code · $name';

  factory ShiftHospital.fromJson(Map<String, dynamic> json) => ShiftHospital(
        id: _stringOf(json['id']),
        code: _stringOf(json['code']),
        name: _stringOf(json['name'], fallback: 'Tanpa nama'),
      );
}

/// Shift kerja beserta ambang toleransi waktunya (GET /shifts).
class AdminShift {
  const AdminShift({
    required this.id,
    required this.hospitalId,
    required this.name,
    required this.startTime,
    required this.endTime,
    required this.overnight,
    required this.gracePeriodMin,
    required this.lateThresholdMin,
    required this.earlyCheckoutThresholdMin,
    required this.hospitalName,
  });

  final String id;
  final String hospitalId;
  final String name;
  final String startTime;
  final String endTime;
  final bool overnight;
  final int gracePeriodMin;
  final int lateThresholdMin;
  final int earlyCheckoutThresholdMin;
  final String hospitalName;

  factory AdminShift.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> hospital = _mapOf(json['hospital']);
    return AdminShift(
      id: _stringOf(json['id']),
      hospitalId: _stringOf(
        json['hospitalId'],
        fallback: _stringOf(hospital['id']),
      ),
      name: _stringOf(json['name'], fallback: 'Tanpa nama'),
      startTime: _stringOf(json['startTime'], fallback: '—'),
      endTime: _stringOf(json['endTime'], fallback: '—'),
      overnight: _boolOf(json['overnight']),
      gracePeriodMin: _intOf(json['gracePeriodMin'], fallback: 15),
      lateThresholdMin: _intOf(json['lateThresholdMin'], fallback: 30),
      earlyCheckoutThresholdMin:
          _intOf(json['earlyCheckoutThresholdMin'], fallback: 15),
      hospitalName: _stringOf(
        hospital['name'],
        fallback: 'Rumah sakit tidak diketahui',
      ),
    );
  }
}

/// Endpoint master shift untuk ADMIN.
///
/// Backend: GET /shifts?hospitalId=, POST /shifts, PATCH /shifts/:id,
/// DELETE /shifts/:id, ditambah GET /hospitals untuk pemilih fasilitas.
class ShiftAdminRepository {
  ShiftAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<ShiftHospital>> hospitals() async {
    final Response<dynamic> res = await _dio.get<dynamic>('/hospitals');
    final Object? data = res.data;
    if (data is! List) return const <ShiftHospital>[];
    final List<ShiftHospital> items = <ShiftHospital>[];
    for (final Object? row in data) {
      if (row is Map) {
        items.add(ShiftHospital.fromJson(Map<String, dynamic>.from(row)));
      }
    }
    return items;
  }

  Future<List<AdminShift>> list({String? hospitalId}) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/shifts',
      queryParameters: <String, dynamic>{
        if (hospitalId != null && hospitalId.isNotEmpty)
          'hospitalId': hospitalId,
      },
    );
    final Object? data = res.data;
    if (data is! List) return const <AdminShift>[];
    final List<AdminShift> items = <AdminShift>[];
    for (final Object? row in data) {
      if (row is Map) {
        items.add(AdminShift.fromJson(Map<String, dynamic>.from(row)));
      }
    }
    return items;
  }

  Future<void> create({
    required String hospitalId,
    required String name,
    required String startTime,
    required String endTime,
    required bool overnight,
    required int gracePeriodMin,
    required int lateThresholdMin,
    required int earlyCheckoutThresholdMin,
  }) async {
    await _dio.post<dynamic>(
      '/shifts',
      data: <String, dynamic>{
        'hospitalId': hospitalId,
        'name': name.trim(),
        'startTime': startTime,
        'endTime': endTime,
        'overnight': overnight,
        'gracePeriodMin': gracePeriodMin,
        'lateThresholdMin': lateThresholdMin,
        'earlyCheckoutThresholdMin': earlyCheckoutThresholdMin,
      },
    );
  }

  Future<void> update(
    String id, {
    required String name,
    required String startTime,
    required String endTime,
    required bool overnight,
    required int gracePeriodMin,
    required int lateThresholdMin,
    required int earlyCheckoutThresholdMin,
  }) async {
    await _dio.patch<dynamic>(
      '/shifts/$id',
      data: <String, dynamic>{
        'name': name.trim(),
        'startTime': startTime,
        'endTime': endTime,
        'overnight': overnight,
        'gracePeriodMin': gracePeriodMin,
        'lateThresholdMin': lateThresholdMin,
        'earlyCheckoutThresholdMin': earlyCheckoutThresholdMin,
      },
    );
  }

  /// Server menolak (409) bila shift masih dipakai pada jadwal karyawan.
  Future<void> delete(String id) async {
    await _dio.delete<dynamic>('/shifts/$id');
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

int _intOf(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

bool _boolOf(Object? value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}
