import 'package:dio/dio.dart';

import '../domain/report_admin_models.dart';

/// Endpoint pelaporan untuk SUPERVISOR ke atas.
///
/// Backend mengembalikan objek tabular langsung untuk `format=json`
/// (lihat `ReportsController.send`), sehingga respons bisa berupa objek
/// laporan maupun `{report: {...}}` tergantung versi backend.
class ReportAdminRepository {
  ReportAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<AdminReport> fetch(
    ReportKind kind, {
    String? date,
    String? month,
    String? from,
    String? to,
    String? employeeId,
  }) async {
    final (String path, Map<String, dynamic> query) target = switch (kind) {
      ReportKind.daily => ('/reports/daily', <String, dynamic>{'date': date}),
      ReportKind.monthly => (
          '/reports/monthly',
          <String, dynamic>{'month': month}
        ),
      ReportKind.lateness => (
          '/reports/late',
          <String, dynamic>{'from': from, 'to': to}
        ),
      ReportKind.leaves => (
          '/reports/leaves',
          <String, dynamic>{'from': from, 'to': to}
        ),
      ReportKind.department => (
          '/reports/department',
          <String, dynamic>{'from': from, 'to': to}
        ),
      ReportKind.employee => (
          '/reports/employee/$employeeId',
          <String, dynamic>{'from': from, 'to': to},
        ),
    };

    final Response<dynamic> res =
        await _dio.get<dynamic>(target.$1, queryParameters: target.$2);
    return AdminReport.fromResponse(res.data);
  }

  /// Daftar karyawan untuk dropdown "Per Karyawan".
  Future<List<AdminEmployeeOption>> employees({int pageSize = 100}) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/employees',
      queryParameters: <String, dynamic>{'pageSize': pageSize},
    );
    final Object? data = res.data;
    final List<dynamic> list;
    if (data is Map) {
      list = (data['data'] as List?) ?? const <dynamic>[];
    } else if (data is List) {
      list = data;
    } else {
      list = const <dynamic>[];
    }
    return list
        .whereType<Map>()
        .map((Map e) =>
            AdminEmployeeOption.fromJson(Map<String, dynamic>.from(e)))
        .where((AdminEmployeeOption e) => e.id.isNotEmpty)
        .toList();
  }
}
