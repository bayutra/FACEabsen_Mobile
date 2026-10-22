
const Map<String, String> leaveTypes = {
  'CUTI': 'Cuti Tahunan',
  'SAKIT': 'Cuti Sakit',
  'IZIN': 'Izin Pribadi',
  'DINAS': 'Dinas Luar',
  'LAINNYA': 'Lainnya',
};

const Map<String, String> leaveStatusLabels = {
  'PENDING': 'Menunggu',
  'APPROVED': 'Disetujui',
  'REJECTED': 'Ditolak',
  'CANCELLED': 'Dibatalkan',
};


String toDateKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';


bool validLeaveRange(String startKey, String endKey) => endKey.compareTo(startKey) >= 0;


int leaveDays(String startKey, String endKey) {
  final DateTime s = DateTime.parse(startKey);
  final DateTime e = DateTime.parse(endKey);
  return e.difference(s).inDays + 1;
}

class LeaveItem {
  LeaveItem({
    required this.id,
    required this.status,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.reason,
    this.reviewNote,
  });

  final String id;
  final String status;
  final String type;
  final String startDate;
  final String endDate;
  final String reason;
  final String? reviewNote;

  factory LeaveItem.fromJson(Map<String, dynamic> json) {
    String key(Object? v) => v is String && v.length >= 10 ? v.substring(0, 10) : '';
    return LeaveItem(
      id: json['id'] as String,
      status: json['status'] as String? ?? '',
      type: json['type'] as String? ?? '',
      startDate: key(json['startDate']),
      endDate: key(json['endDate']),
      reason: json['reason'] as String? ?? '',
      reviewNote: json['reviewNote'] as String?,
    );
  }
}
