// Model laporan untuk layar admin Laporan.
//
// Semua endpoint `/reports/*` mengembalikan bentuk tabular yang sama
// (judul, waktu dibuat, ringkasan, header, dan baris) meski isi setiap
// laporan berbeda. Parsing dilakukan defensif karena backend bisa
// membungkus objek di dalam `{report: {...}}` pada sebagian format.

/// Jenis laporan yang bisa diminta ke backend.
enum ReportKind {
  daily('daily', 'Harian'),
  monthly('monthly', 'Bulanan'),
  lateness('late', 'Terlambat'),
  leaves('leaves', 'Izin/Cuti'),
  department('department', 'Per Unit'),
  employee('employee', 'Per Karyawan');

  const ReportKind(this.code, this.label);

  /// Kode yang dipakai di URL query / path.
  final String code;

  /// Label yang ditampilkan pada chip pemilih.
  final String label;

  static ReportKind fromCode(String? code) => ReportKind.values.firstWhere(
        (ReportKind k) => k.code == code,
        orElse: () => ReportKind.daily,
      );
}

/// Satu baris ringkasan: label + angka.
class ReportSummaryItem {
  const ReportSummaryItem({required this.label, required this.value});

  final String label;
  final String value;
}

/// Karyawan untuk dropdown "Per Karyawan".
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

/// Isi satu laporan tabular.
class AdminReport {
  const AdminReport({
    required this.title,
    required this.generatedAt,
    required this.summary,
    required this.headers,
    required this.rows,
  });

  final String title;
  final DateTime? generatedAt;
  final List<ReportSummaryItem> summary;
  final List<String> headers;
  final List<List<String>> rows;

  bool get isEmpty => rows.isEmpty;

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
    );
  }
}
