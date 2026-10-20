/// Model & label untuk antrean koreksi presensi (ADMIN / SUPERVISOR).
///
/// Backend: `GET /corrections` mengembalikan array `CorrectionRequest` dengan
/// relasi `employee` dan `attendance` (lihat `corrections.service.ts`).
library;

const Map<String, String> correctionTypeLabels = <String, String>{
  'MISSED_CHECK_IN': 'Lupa presensi masuk',
  'MISSED_CHECK_OUT': 'Lupa presensi pulang',
  'WRONG_TIME': 'Jam presensi salah',
  'TECHNICAL_ISSUE': 'Kendala teknis',
};

String correctionTypeLabel(String type) => correctionTypeLabels[type] ?? type;

String correctionStatusLabel(String status) => switch (status) {
  'PENDING' => 'Menunggu',
  'APPROVED' => 'Disetujui',
  'REJECTED' => 'Ditolak',
  'CANCELLED' => 'Dibatalkan',
  _ => status,
};

class AdminCorrection {
  const AdminCorrection({
    required this.id,
    required this.employeeName,
    required this.employeeNo,
    required this.type,
    required this.status,
    required this.reason,
    this.employeeId,
    this.attendanceId,
    this.attendanceWorkDate,
    this.attendanceCheckIn,
    this.attendanceCheckOut,
    this.requestedCheckIn,
    this.requestedCheckOut,
    this.requestedAt,
    this.reviewedAt,
    this.reviewNote,
  });

  final String id;
  final String? employeeId;
  final String employeeName;
  final String employeeNo;
  final String? attendanceId;
  final DateTime? attendanceWorkDate;
  final DateTime? attendanceCheckIn;
  final DateTime? attendanceCheckOut;
  final String type;
  final String status;
  final DateTime? requestedCheckIn;
  final DateTime? requestedCheckOut;
  final String reason;
  final DateTime? requestedAt;
  final DateTime? reviewedAt;
  final String? reviewNote;

  bool get pending => status == 'PENDING';

  String get typeLabel => correctionTypeLabel(type);

  String get statusLabel => correctionStatusLabel(status);

  factory AdminCorrection.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? employee = json['employee'] is Map
        ? Map<String, dynamic>.from(json['employee'] as Map)
        : null;
    final Map<String, dynamic>? attendance = json['attendance'] is Map
        ? Map<String, dynamic>.from(json['attendance'] as Map)
        : null;
    return AdminCorrection(
      id: _text(json['id']),
      employeeId: _textOrNull(json['employeeId']),
      employeeName: _text(employee?['name']),
      employeeNo: _text(employee?['employeeNo']),
      attendanceId: _textOrNull(json['attendanceId']),
      attendanceWorkDate: _date(attendance?['workDate']),
      attendanceCheckIn: _date(attendance?['checkInAt']),
      attendanceCheckOut: _date(attendance?['checkOutAt']),
      type: _text(json['type']),
      status: _text(json['status'], 'PENDING'),
      requestedCheckIn: _date(json['requestedCheckIn']),
      requestedCheckOut: _date(json['requestedCheckOut']),
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
