import 'package:dio/dio.dart';


class AdminScheduleEntry {
  const AdminScheduleEntry({
    required this.id,
    required this.workDate,
    required this.shiftId,
    required this.shiftName,
    required this.shiftStart,
    required this.shiftEnd,
    required this.shiftOvernight,
    required this.employeeName,
    required this.employeeNo,
  });

  final String id;
  final DateTime? workDate;
  final String shiftId;
  final String shiftName;
  final String shiftStart;
  final String shiftEnd;
  final bool shiftOvernight;
  final String employeeName;
  final String employeeNo;

  factory AdminScheduleEntry.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> shift = _mapOf(json['shift']);
    final Map<String, dynamic> employee = _mapOf(json['employee']);
    return AdminScheduleEntry(
      id: _stringOf(json['id']),
      workDate: _dateOf(json['workDate']),
      shiftId: _stringOf(json['shiftId'], fallback: _stringOf(shift['id'])),
      shiftName: _stringOf(shift['name'], fallback: 'Shift'),
      shiftStart: _stringOf(shift['startTime'], fallback: '—'),
      shiftEnd: _stringOf(shift['endTime'], fallback: '—'),
      shiftOvernight: _boolOf(shift['overnight']),
      employeeName: _stringOf(employee['name'], fallback: 'Karyawan'),
      employeeNo: _stringOf(employee['employeeNo'], fallback: '—'),
    );
  }
}


class AdminSchedulePage {
  const AdminSchedulePage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.totalItems,
  });

  final List<AdminScheduleEntry> items;
  final int page;
  final int totalPages;
  final int totalItems;
}


class AdminScheduleEmployee {
  const AdminScheduleEmployee({
    required this.id,
    required this.name,
    required this.employeeNo,
    required this.departmentName,
  });

  final String id;
  final String name;
  final String employeeNo;
  final String departmentName;

  String get label => departmentName.isEmpty
      ? '$name ($employeeNo)'
      : '$name ($employeeNo) · $departmentName';

  factory AdminScheduleEmployee.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> department = _mapOf(json['department']);
    return AdminScheduleEmployee(
      id: _stringOf(json['id']),
      name: _stringOf(json['name'], fallback: 'Tanpa nama'),
      employeeNo: _stringOf(json['employeeNo'], fallback: '—'),
      departmentName: _stringOf(department['name']),
    );
  }
}


class AdminShiftOption {
  const AdminShiftOption({
    required this.id,
    required this.name,
    required this.startTime,
    required this.endTime,
    required this.overnight,
    required this.hospitalCode,
  });

  final String id;
  final String name;
  final String startTime;
  final String endTime;
  final bool overnight;
  final String hospitalCode;

  String get label {
    final String window = '$startTime–$endTime';
    return hospitalCode.isEmpty
        ? '$name · $window'
        : '$name · $window ($hospitalCode)';
  }

  factory AdminShiftOption.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> hospital = _mapOf(json['hospital']);
    return AdminShiftOption(
      id: _stringOf(json['id']),
      name: _stringOf(json['name'], fallback: 'Shift'),
      startTime: _stringOf(json['startTime'], fallback: '—'),
      endTime: _stringOf(json['endTime'], fallback: '—'),
      overnight: _boolOf(json['overnight']),
      hospitalCode: _stringOf(hospital['code']),
    );
  }
}






class ScheduleAdminRepository {
  ScheduleAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<AdminSchedulePage> list({
    required DateTime from,
    required DateTime to,
    int page = 1,
    int pageSize = 20,
  }) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/schedules',
      queryParameters: <String, dynamic>{
        'from': _dateKey(from),
        'to': _dateKey(to),
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> body = _mapOf(res.data);
    final List<dynamic> rows = _listOf(body['data']);
    final Map<String, dynamic> pagination = _mapOf(body['pagination']);
    final List<AdminScheduleEntry> items = <AdminScheduleEntry>[];
    for (final Object? row in rows) {
      if (row is Map) {
        items.add(
          AdminScheduleEntry.fromJson(Map<String, dynamic>.from(row)),
        );
      }
    }
    return AdminSchedulePage(
      items: items,
      page: _intOf(pagination['page'], fallback: page),
      totalPages: _intOf(pagination['totalPages'], fallback: 1),
      totalItems: _intOf(pagination['totalItems'], fallback: items.length),
    );
  }

  
  
  Future<List<AdminScheduleEmployee>> activeEmployees() async {
    final List<AdminScheduleEmployee> items = <AdminScheduleEmployee>[];
    int page = 1;
    int totalPages = 1;
    while (page <= totalPages && page <= 20) {
      final Response<dynamic> res = await _dio.get<dynamic>(
        '/employees',
        queryParameters: <String, dynamic>{
          'page': page,
          'pageSize': 100,
          'status': 'ACTIVE',
        },
      );
      final Object? raw = res.data;
      final List<dynamic> rows =
          raw is List ? raw : _listOf(_mapOf(raw)['data']);
      for (final Object? row in rows) {
        if (row is Map) {
          items.add(
            AdminScheduleEmployee.fromJson(Map<String, dynamic>.from(row)),
          );
        }
      }
      final Map<String, dynamic> pagination = _mapOf(_mapOf(raw)['pagination']);
      totalPages = _intOf(pagination['totalPages'], fallback: 1);
      page++;
    }
    return items;
  }

  Future<List<AdminShiftOption>> shiftOptions() async {
    final Response<dynamic> res = await _dio.get<dynamic>('/shifts');
    final Object? data = res.data;
    if (data is! List) return const <AdminShiftOption>[];
    final List<AdminShiftOption> items = <AdminShiftOption>[];
    for (final Object? row in data) {
      if (row is Map) {
        items.add(AdminShiftOption.fromJson(Map<String, dynamic>.from(row)));
      }
    }
    return items;
  }

  Future<void> create({
    required String employeeId,
    required String shiftId,
    required DateTime workDate,
  }) async {
    await _dio.post<dynamic>(
      '/schedules',
      data: <String, dynamic>{
        'employeeId': employeeId,
        'shiftId': shiftId,
        'workDate': _dateKey(workDate),
      },
    );
  }

  Future<void> delete(String id) async {
    await _dio.delete<dynamic>('/schedules/$id');
  }
}

String _dateKey(DateTime date) => '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';



DateTime? _dateOf(Object? value) {
  if (value is! String || value.isEmpty) return null;
  final List<String> parts = value.split('T').first.split('-');
  if (parts.length != 3) return null;
  final int? year = int.tryParse(parts[0]);
  final int? month = int.tryParse(parts[1]);
  final int? day = int.tryParse(parts[2]);
  if (year == null || month == null || day == null) return null;
  return DateTime(year, month, day);
}

Map<String, dynamic> _mapOf(Object? value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

List<dynamic> _listOf(Object? value) {
  if (value is List) return value;
  return const <dynamic>[];
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
