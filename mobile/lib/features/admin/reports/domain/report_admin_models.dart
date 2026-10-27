import 'dart:typed_data';

enum ReportKind {
  daily('daily', 'Harian'),
  monthly('monthly', 'Bulanan'),
  lateness('late', 'Terlambat'),
  leaves('leaves', 'Izin/Cuti'),
  department('department', 'Per Unit'),
  employee('employee', 'Per Karyawan'),
  heatmap('heatmap', 'Heatmap');

  const ReportKind(this.code, this.label);

  final String code;

  final String label;

  static ReportKind fromCode(String? code) => ReportKind.values.firstWhere(
        (ReportKind k) => k.code == code,
        orElse: () => ReportKind.daily,
      );
}

class ReportSummaryItem {
  const ReportSummaryItem({required this.label, required this.value});

  final String label;
  final String value;
}

class AdminEmployeeOption {
  const AdminEmployeeOption({
    required this.id,
    required this.employeeNo,
    required this.name,
  });

  final String id;
  final String employeeNo;
  final String name;

  String get label => employeeNo.isEmpty ? name : '$employeeNo Â· $name';

  factory AdminEmployeeOption.fromJson(Map<String, dynamic> json) =>
      AdminEmployeeOption(
        id: json['id']?.toString() ?? '',
        employeeNo: json['employeeNo']?.toString() ?? '',
        name: json['name']?.toString() ?? 'â€”',
      );
}

class AdminReport {
  const AdminReport({
    required this.title,
    required this.generatedAt,
    required this.summary,
    required this.headers,
    required this.rows,
    this.heatmap,
  });

  final String title;
  final DateTime? generatedAt;
  final List<ReportSummaryItem> summary;
  final List<String> headers;
  final List<List<String>> rows;
  final AdminHeatmap? heatmap;

  bool get isEmpty => rows.isEmpty && heatmap == null;

  factory AdminReport.fromResponse(Object? data) {
    Map<String, dynamic> body = const <String, dynamic>{};
    if (data is Map) {
      final Map<String, dynamic> map = Map<String, dynamic>.from(data);
      final Object? report = map['report'];
      if (report is Map) {
        body = Map<String, dynamic>.from(report);
      } else if (map.containsKey('title') || map.containsKey('rows')) {
        body = map;
      }
    }
    return AdminReport.fromJson(body);
  }

  factory AdminReport.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawSummary =
        (json['summary'] as List?) ?? const <dynamic>[];
    final List<ReportSummaryItem> summary = <ReportSummaryItem>[];
    for (final dynamic item in rawSummary) {
      if (item is List && item.length >= 2) {
        summary.add(ReportSummaryItem(
          label: item[0]?.toString() ?? '-',
          value: item[1]?.toString() ?? '0',
        ));
      }
    }

    final List<dynamic> rawHeaders =
        (json['headers'] as List?) ?? const <dynamic>[];
    final List<String> headers = rawHeaders
        .map((dynamic h) => h?.toString() ?? '')
        .where((String h) => h.isNotEmpty)
        .toList();

    final List<dynamic> rawRows = (json['rows'] as List?) ?? const <dynamic>[];
    final List<List<String>> rows = rawRows
        .whereType<List>()
        .map((List row) => row
            .map((dynamic cell) => cell?.toString() ?? '-')
            .toList(growable: false))
        .toList();

    return AdminReport(
      title: json['title']?.toString() ?? 'Laporan',
      generatedAt: DateTime.tryParse(json['generatedAt']?.toString() ?? ''),
      summary: summary,
      headers: headers,
      rows: rows,
      heatmap: json['cells'] is List ? AdminHeatmap.fromJson(json) : null,
    );
  }
}

class AdminHeatmap {
  const AdminHeatmap({
    required this.days,
    required this.hours,
    required this.cells,
    required this.maxCount,
    required this.totalCheckIns,
    required this.lateCheckIns,
    this.peakDay,
    this.peakHour,
    this.peakCount = 0,
  });

  final List<String> days;
  final List<int> hours;
  final List<List<int>> cells;
  final int maxCount;
  final int totalCheckIns;
  final int lateCheckIns;
  final String? peakDay;
  final int? peakHour;
  final int peakCount;

  factory AdminHeatmap.fromJson(Map<String, dynamic> json) {
    final List<String> days = ((json['days'] as List?) ?? const <dynamic>[])
        .map((dynamic e) => e.toString())
        .toList(growable: false);
    final List<int> hours = ((json['hours'] as List?) ?? const <dynamic>[])
        .map((dynamic e) => int.tryParse(e.toString()) ?? 0)
        .toList(growable: false);
    final List<List<int>> cells =
        ((json['cells'] as List?) ?? const <dynamic>[])
            .whereType<List>()
            .map((List row) => row
                .map((dynamic e) => int.tryParse(e.toString()) ?? 0)
                .toList(growable: false))
            .toList(growable: false);
    final Object? rawPeak = json['peak'];
    final Map<String, dynamic> peak = rawPeak is Map
        ? Map<String, dynamic>.from(rawPeak)
        : const <String, dynamic>{};
    return AdminHeatmap(
      days: days,
      hours: hours,
      cells: cells,
      maxCount: (json['maxCount'] as num?)?.toInt() ?? 0,
      totalCheckIns: (json['totalCheckIns'] as num?)?.toInt() ?? 0,
      lateCheckIns: (json['lateCheckIns'] as num?)?.toInt() ?? 0,
      peakDay: peak['day']?.toString(),
      peakHour: (peak['hour'] as num?)?.toInt(),
      peakCount: (peak['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class ReportExport {
  const ReportExport({
    required this.bytes,
    required this.filename,
    required this.mimeType,
  });

  final Uint8List bytes;
  final String filename;
  final String mimeType;
}
