
class AttendanceResult {
  AttendanceResult({
    required this.id,
    required this.workDate,
    this.checkInAt,
    this.checkInStatus,
    this.checkOutAt,
    this.checkOutStatus,
    this.shiftLabel,
    this.faceScore,
    this.riskScore,
    this.riskCategory,
    this.needsReview = false,
  });

  final String id;
  final String workDate;
  final String? checkInAt;
  final String? checkInStatus;
  final String? checkOutAt;
  final String? checkOutStatus;
  final String? shiftLabel;
  final double? faceScore;
  final int? riskScore;
  final String? riskCategory;
  final bool needsReview;

  static Map<String, dynamic>? _riskOf(Map<String, dynamic> json) {
    final Map? risk = json['risk'] as Map?;
    return risk?.cast<String, dynamic>();
  }

  factory AttendanceResult.fromCheckIn(Map<String, dynamic> json) {
    final Map? face = json['faceMatch'] as Map?;
    final Map? shift = json['shift'] as Map?;
    final Map<String, dynamic>? risk = _riskOf(json);
    return AttendanceResult(
      id: json['id'] as String,
      workDate: json['workDate'] as String,
      checkInAt: json['checkInAt'] as String?,
      checkInStatus: json['checkInStatus'] as String?,
      shiftLabel: shift == null ? null : '${shift['name']} · ${shift['window']}',
      faceScore: (face?['score'] as num?)?.toDouble(),
      riskScore: (risk?['score'] as num?)?.toInt(),
      riskCategory: risk?['category'] as String?,
      needsReview: risk?['needsReview'] == true,
    );
  }

  factory AttendanceResult.fromCheckOut(Map<String, dynamic> json) {
    final Map? face = json['faceMatch'] as Map?;
    final Map<String, dynamic>? risk = _riskOf(json);
    return AttendanceResult(
      id: json['id'] as String,
      workDate: json['workDate'] as String,
      checkInAt: json['checkInAt'] as String?,
      checkInStatus: json['checkInStatus'] as String?,
      checkOutAt: json['checkOutAt'] as String?,
      checkOutStatus: json['checkOutStatus'] as String?,
      faceScore: (face?['score'] as num?)?.toDouble(),
      riskScore: (risk?['score'] as num?)?.toInt(),
      riskCategory: risk?['category'] as String?,
      needsReview: risk?['needsReview'] == true,
    );
  }
}

String riskCategoryLabel(String? category) {
  switch (category) {
    case 'LOW':
      return 'Risiko Rendah';
    case 'MEDIUM':
      return 'Risiko Sedang';
    case 'HIGH':
      return 'Risiko Tinggi';
    default:
      return '—';
  }
}


class AttendanceHistoryItem {
  AttendanceHistoryItem({
    required this.id,
    required this.workDate,
    this.checkInAt,
    this.checkInStatus,
    this.checkOutAt,
    this.checkOutStatus,
    this.shiftName,
    this.shiftWindow,
    this.riskScore,
    this.riskCategory,
    this.needsReview = false,
  });

  final String id;
  final String workDate;
  final String? checkInAt;
  final String? checkInStatus;
  final String? checkOutAt;
  final String? checkOutStatus;
  final String? shiftName;
  final String? shiftWindow;
  final int? riskScore;
  final String? riskCategory;
  final bool needsReview;

  factory AttendanceHistoryItem.fromJson(Map<String, dynamic> json) {
    final Map? shift = json['shift'] as Map?;
    final Map? risk = json['risk'] as Map?;
    return AttendanceHistoryItem(
      id: json['id'] as String,
      workDate: (json['workDate'] as String?)?.substring(0, 10) ?? '',
      checkInAt: json['checkInAt'] as String?,
      checkInStatus: json['checkInStatus'] as String?,
      checkOutAt: json['checkOutAt'] as String?,
      checkOutStatus: json['checkOutStatus'] as String?,
      shiftName: shift?['name'] as String?,
      shiftWindow: shift == null
          ? null
          : '${shift['startTime']} → ${shift['endTime']}${shift['overnight'] == true ? ' (+1)' : ''}',
      riskScore: (json['riskScore'] as num?)?.toInt() ?? (risk?['score'] as num?)?.toInt(),
      riskCategory:
          (json['riskCategory'] as String?) ?? (risk?['category'] as String?),
      needsReview: (json['needsReview'] as bool?) ?? false,
    );
  }
}

class AttendanceHistoryPage {
  AttendanceHistoryPage({required this.items, required this.page, required this.totalPages, required this.totalItems});

  final List<AttendanceHistoryItem> items;
  final int page;
  final int totalPages;
  final int totalItems;

  factory AttendanceHistoryPage.fromJson(Map<String, dynamic> json) {
    final List list = (json['data'] as List?) ?? [];
    final Map pagination = (json['pagination'] as Map?) ?? {};
    return AttendanceHistoryPage(
      items: list.map((e) => AttendanceHistoryItem.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
      page: (pagination['page'] as num?)?.toInt() ?? 1,
      totalPages: (pagination['totalPages'] as num?)?.toInt() ?? 1,
      totalItems: (pagination['totalItems'] as num?)?.toInt() ?? 0,
    );
  }
}


String toHistoryQueryString({int page = 1, String? checkInStatus, String? from, String? to}) {
  final params = <String, String>{};
  if (page > 1) params['page'] = '$page';
  if (checkInStatus?.isNotEmpty == true) params['checkInStatus'] = checkInStatus!;
  if (from?.isNotEmpty == true) params['from'] = from!;
  if (to?.isNotEmpty == true) params['to'] = to!;
  if (params.isEmpty) return '';
  return '?${params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
}

String checkInStatusLabel(String? status) {
  switch (status) {
    case 'ON_TIME':
      return 'Tepat Waktu';
    case 'LATE':
      return 'Terlambat';
    case 'VERY_LATE':
      return 'Sangat Terlambat';
    default:
      return status ?? '—';
  }
}

String checkOutStatusLabel(String? status) {
  switch (status) {
    case 'NORMAL_CHECKOUT':
      return 'Pulang Normal';
    case 'EARLY_CHECKOUT':
      return 'Pulang Cepat';
    default:
      return status ?? '—';
  }
}


String attendanceRejectMessage(String? reason) {
  switch (reason) {
    case 'FACE_MISMATCH':
      return 'Wajah tidak cocok. Coba lagi di cahaya cukup.';
    case 'NO_FACE_TEMPLATE':
      return 'Belum ada wajah terdaftar. Daftarkan dulu.';
    case 'LIVENESS_FAILED':
    case 'LIVENESS_STALE':
    case 'LIVENESS_EMPTY':
      return 'Liveness tidak valid. Ulangi verifikasi.';
    case 'DEVICE_NOT_ACTIVE':
      return 'Perangkat tidak aktif.';
    case 'WRONG_OWNER_DEVICE':
      return 'Perangkat ini terdaftar pada akun lain. Logout lalu login ulang.';
    case 'UNKNOWN_DEVICE':
      return 'Perangkat belum terdaftar. Login ulang untuk mendaftarkan ulang.';
    case 'INVALID_SIGNATURE':
      return 'Sesi perangkat bermasalah. Login ulang.';
    case 'DEVICE_COMPROMISED':
      return 'Perangkat terindikasi kompromi.';
    case 'INTEGRITY_FAILED':
      return 'Verifikasi integritas perangkat gagal.';
    case 'NO_SCHEDULE':
      return 'Tidak ada jadwal hari ini.';
    case 'ALREADY_CHECKED_IN':
      return 'Sudah check-in. Selesaikan check-out dulu.';
    case 'NO_OPEN_ATTENDANCE':
      return 'Belum check-in.';
    case 'DUPLICATE_REQUEST':
      return 'Request ganda, diabaikan.';
    case 'STALE_REQUEST':
      return 'Request kedaluwarsa. Coba lagi.';
    case 'NO_CONSENT':
      return 'Persetujuan biometrik diperlukan. Daftarkan ulang persetujuan.';
    default:
      return 'Presensi ditolak.';
  }
}
