library;

const Map<String, String> leaveTypeLabels = <String, String>{
  'CUTI': 'Cuti',
  'SAKIT': 'Sakit',
  'IZIN': 'Izin',
  'DINAS': 'Dinas',
  'LAINNYA': 'Lainnya',
};

String leaveTypeLabel(String type) => leaveTypeLabels[type] ?? type;

String leaveStatusLabel(String status) => switch (status) {
      'PENDING' => 'Menunggu',
      'APPROVED' => 'Disetujui',
      'REJECTED' => 'Ditolak',
      'CANCELLED' => 'Dibatalkan',
      _ => status,
    };

class AdminLeave {
  const AdminLeave({
    required this.id,
    required this.employeeName,
    required this.employeeNo,
    required this.type,
    required this.status,
    required this.reason,
    this.employeeId,
    this.startDate,
    this.endDate,
    this.requestedAt,
    this.reviewedAt,
    this.reviewNote,
  });

  final String id;
  final String? employeeId;
  final String employeeName;
  final String employeeNo;
  final String type;
  final String status;
  final DateTime? startDate;
  final DateTime? endDate;
  final String reason;
  final DateTime? requestedAt;
  final DateTime? reviewedAt;
  final String? reviewNote;

  bool get pending => status == 'PENDING';

  String get typeLabel => leaveTypeLabel(type);

  String get statusLabel => leaveStatusLabel(status);

  int? get dayCount {
    final DateTime? start = startDate;
    final DateTime? end = endDate;
    if (start == null || end == null) return null;
    final int days = end.difference(start).inDays + 1;
    return days > 0 ? days : null;
  }

  factory AdminLeave.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? employee = json['employee'] is Map
        ? Map<String, dynamic>.from(json['employee'] as Map)
        : null;
    return AdminLeave(
      id: _text(json['id']),
      employeeId: _textOrNull(json['employeeId']),
      employeeName: _text(employee?['name']),
      employeeNo: _text(employee?['employeeNo']),
      type: _text(json['type']),
      status: _text(json['status'], 'PENDING'),
      startDate: _date(json['startDate']),
      endDate: _date(json['endDate']),
      reason: _text(json['reason']),
      requestedAt: _date(json['requestedAt']),
      reviewedAt: _date(json['reviewedAt']),
      reviewNote: _textOrNull(json['reviewNote']),
    );
  }
}

String _text(Object? value, [String fallback = '—']) {
  if (value is String && value.trim().isNotEmpty) return value;
  if (value is num) return value.toString();
  return fallback;
}

String? _textOrNull(Object? value) {
  if (value is String && value.trim().isNotEmpty) return value;
  if (value is num) return value.toString();
  return null;
}

DateTime? _date(Object? value) {
  if (value is String) return DateTime.tryParse(value);
  return null;
}
