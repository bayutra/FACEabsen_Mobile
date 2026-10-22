
const Map<String, String> correctionTypes = {
  'MISSED_CHECK_IN': 'Lupa Check-in',
  'MISSED_CHECK_OUT': 'Lupa check-out',
  'WRONG_TIME': 'Kesalahan waktu',
  'TECHNICAL_ISSUE': 'Masalah teknis',
};

const Map<String, String> correctionStatusLabels = {
  'PENDING': 'Menunggu',
  'APPROVED': 'Disetujui',
  'REJECTED': 'Ditolak',
  'CANCELLED': 'Dibatalkan',
};



String? combineWorkDateTime(String workDate, String hhmm) {
  final String t = hhmm.trim();
  if (t.isEmpty) return null;
  if (!RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(t)) return null;
  return '${workDate}T$t:00.000Z';
}

class CorrectionItem {
  CorrectionItem({
    required this.id,
    required this.status,
    required this.type,
    required this.reason,
    this.requestedCheckIn,
    this.requestedCheckOut,
    this.workDate,
    this.reviewNote,
  });

  final String id;
  final String status;
  final String type;
  final String reason;
  final String? requestedCheckIn;
  final String? requestedCheckOut;
  final String? workDate;
  final String? reviewNote;

  factory CorrectionItem.fromJson(Map<String, dynamic> json) {
    final Map? att = json['attendance'] as Map?;
    String? workDate;
    final Object? wd = att?['workDate'];
    if (wd is String && wd.length >= 10) workDate = wd.substring(0, 10);
    return CorrectionItem(
      id: json['id'] as String,
      status: json['status'] as String? ?? '',
      type: json['type'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      requestedCheckIn: json['requestedCheckIn'] as String?,
      requestedCheckOut: json['requestedCheckOut'] as String?,
      workDate: workDate,
      reviewNote: json['reviewNote'] as String?,
    );
  }
}
