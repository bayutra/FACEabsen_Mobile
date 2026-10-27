import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../domain/report_admin_models.dart';

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
    final (String, Map<String, dynamic>) target = _target(
      kind,
      date: date,
      month: month,
      from: from,
      to: to,
      employeeId: employeeId,
    );

    final Response<dynamic> res = await _dio.get<dynamic>(
      target.$1,
      queryParameters: target.$2,
    );
    return AdminReport.fromResponse(res.data);
  }

  Future<ReportExport> export(
    ReportKind kind, {
    required String format,
    String? date,
    String? month,
    String? from,
    String? to,
    String? employeeId,
  }) async {
    final (String, Map<String, dynamic>) target = _target(
      kind,
      date: date,
      month: month,
      from: from,
      to: to,
      employeeId: employeeId,
    );

    final Response<List<int>> res = await _dio.get<List<int>>(
      target.$1,
      queryParameters: <String, dynamic>{...target.$2, 'format': format},
      options: Options(responseType: ResponseType.bytes),
    );
    final List<int>? body = res.data;
    if (body == null || body.isEmpty) {
      throw StateError('Berkas laporan kosong');
    }

    final String filename =
        _filenameFromDisposition(res.headers.value('content-disposition')) ??
            _fallbackFilename(
              kind,
              format,
              date: date,
              month: month,
              from: from,
              to: to,
              employeeId: employeeId,
            );
    final String rawType =
        res.headers.value('content-type') ?? _mimeFor(format);
    return ReportExport(
      bytes: Uint8List.fromList(body),
      filename: filename,
      mimeType: rawType.split(';').first.trim(),
    );
  }

  (String, Map<String, dynamic>) _target(
    ReportKind kind, {
    String? date,
    String? month,
    String? from,
    String? to,
    String? employeeId,
  }) {
    return switch (kind) {
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
      ReportKind.heatmap => (
          '/reports/heatmap',
          <String, dynamic>{'from': from, 'to': to},
        ),
    };
  }

  Future<List<AdminEmployeeOption>> employees({int pageSize = 100}) async {
    final Response<dynamic> res;
    try {
      res = await _dio.get<dynamic>(
        '/employees',
        queryParameters: <String, dynamic>{'pageSize': pageSize},
      );
    } on DioException catch (e) {
      if (e.response?.statusCode != 403) rethrow;
      final Response<dynamic> team =
          await _dio.get<dynamic>('/supervisor/team');
      final Object? teamData = team.data;
      if (teamData is! List) return const <AdminEmployeeOption>[];
      return teamData
          .whereType<Map>()
          .map((Map e) =>
              AdminEmployeeOption.fromJson(Map<String, dynamic>.from(e)))
          .where((AdminEmployeeOption e) => e.id.isNotEmpty)
          .toList();
    }
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

  String? _filenameFromDisposition(String? value) {
    if (value == null || value.isEmpty) return null;
    final RegExpMatch? quoted = RegExp(
      r'filename="([^"]+)"',
      caseSensitive: false,
    ).firstMatch(value);
    if (quoted != null) return quoted.group(1);
    final RegExpMatch? plain = RegExp(
      r'filename=([^;]+)',
      caseSensitive: false,
    ).firstMatch(value);
    return plain?.group(1)?.trim();
  }

  String _fallbackFilename(
    ReportKind kind,
    String format, {
    String? date,
    String? month,
    String? from,
    String? to,
    String? employeeId,
  }) {
    final String suffix = switch (kind) {
      ReportKind.daily => date ?? 'harian',
      ReportKind.monthly => month ?? 'bulanan',
      ReportKind.employee =>
        'karyawan-${employeeId ?? ''}-${from ?? ''}-${to ?? ''}',
      _ => '${from ?? ''}-${to ?? ''}',
    };
    final String extension = format == 'xlsx' ? 'xlsx' : format;
    return 'laporan-${kind.code}-$suffix.$extension'.replaceAll(
      RegExp(r'[^A-Za-z0-9._-]+'),
      '-',
    );
  }

  String _mimeFor(String format) {
    return switch (format) {
      'csv' => 'text/csv',
      'xlsx' =>
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'pdf' => 'application/pdf',
      _ => 'application/octet-stream',
    };
  }
}
