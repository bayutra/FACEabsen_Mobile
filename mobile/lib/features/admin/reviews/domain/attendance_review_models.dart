/// Model antrean tinjauan presensi berisiko (SUPERVISOR / ADMIN).
///
/// Backend: `GET /attendance/review` mengembalikan `{data, pagination}` dengan
/// relasi `employee.department` dan `shift`.
library;

String attendanceCheckInLabel(String? status) => switch (status) {
  'ON_TIME' => 'Tepat waktu',
  'LATE' => 'Terlambat',
  'VERY_LATE' => 'Sangat terlambat',
  _ => '—',
};

String riskCategoryLabel(String? category) => switch (category) {
  'LOW' => 'Risiko rendah',
  'MEDIUM' => 'Risiko sedang',
  'HIGH' => 'Risiko tinggi',
  _ => '—',
};

class AttendanceReviewItem {
  const AttendanceReviewItem({
    required this.id,
    required this.employeeName,
    required this.employeeNo,
    this.departmentName,
    this.workDate,
    this.checkInAt,
    this.checkOutAt,
    this.checkInStatus,
    this.riskScore,
    this.riskCategory,
    this.shiftName,
    this.shiftWindow,
  });

  final String id;
  final String employeeName;
  final String employeeNo;
  final String? departmentName;
  final DateTime? workDate;
  final DateTime? checkInAt;
  final DateTime? checkOutAt;
  final String? checkInStatus;
  final int? riskScore;
  final String? riskCategory;
  final String? shiftName;
  final String? shiftWindow;

  String get checkInLabel => attendanceCheckInLabel(checkInStatus);

  String get riskLabel => riskCategoryLabel(riskCategory);

  factory AttendanceReviewItem.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? employee = json['employee'] is Map
        ? Map<String, dynamic>.from(json['employee'] as Map)
        : null;
    final Map<String, dynamic>? department = employee?['department'] is Map
        ? Map<String, dynamic>.from(employee!['department'] as Map)
        : null;
    final Map<String, dynamic>? shift = json['shift'] is Map
        ? Map<String, dynamic>.from(json['shift'] as Map)
        : null;
    final String? start = _textOrNull(shift?['startTime']);
    final String? end = _textOrNull(shift?['endTime']);
    return AttendanceReviewItem(
      id: _text(json['id']),
      employeeName: _text(employee?['name']),
      employeeNo: _text(employee?['employeeNo']),
      departmentName: _textOrNull(department?['name']),
      workDate: _date(json['workDate']),
      checkInAt: _date(json['checkInAt']),
      checkOutAt: _date(json['checkOutAt']),
      checkInStatus: _textOrNull(json['checkInStatus']),
      riskScore: json['riskScore'] is num
          ? (json['riskScore'] as num).toInt()
          : null,
      riskCategory: _textOrNull(json['riskCategory']),
      shiftName: _textOrNull(shift?['name']),
      shiftWindow: start != null && end != null ? '$start–$end' : null,
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
