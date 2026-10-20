/// Model & label untuk antrean penggantian perangkat.
///
/// Backend menyimpan `reason` sebagai kode + catatan opsional, mis.
/// `BROKEN: layar pecah`, jadi kode diambil dari bagian sebelum `:`.
library;

const Map<String, String> deviceChangeReasonLabels = <String, String>{
  'BROKEN': 'Perangkat rusak',
  'LOST': 'Perangkat hilang',
  'STOLEN': 'Perangkat dicuri',
  'UPGRADE': 'Upgrade perangkat',
  'OTHER': 'Lainnya',
};

String deviceChangeReasonLabel(String code) =>
    deviceChangeReasonLabels[code] ?? code;

String deviceChangeStatusLabel(String status) => switch (status) {
  'PENDING' => 'Menunggu',
  'APPROVED' => 'Disetujui',
  'REJECTED' => 'Ditolak',
  'CANCELLED' => 'Dibatalkan',
  _ => status,
};

String devicePlatformLabel(String? platform) => switch (platform) {
  'ANDROID' => 'Android',
  'IOS' => 'iOS',
  _ => platform == null || platform.isEmpty ? '—' : platform,
};

class AdminDeviceChange {
  const AdminDeviceChange({
    required this.id,
    required this.employeeName,
    required this.employeeNo,
    required this.reason,
    required this.status,
    this.employeeId,
    this.oldDeviceId,
    this.oldDeviceName,
    this.oldPlatform,
    this.newDeviceId,
    this.newDeviceName,
    this.newPlatform,
    this.requestedAt,
    this.reviewedAt,
    this.reviewNote,
  });

  final String id;
  final String? employeeId;
  final String employeeName;
  final String employeeNo;
  final String? oldDeviceId;
  final String? oldDeviceName;
  final String? oldPlatform;
  final String? newDeviceId;
  final String? newDeviceName;
  final String? newPlatform;
  final String reason;
  final String status;
  final DateTime? requestedAt;
  final DateTime? reviewedAt;
  final String? reviewNote;

  bool get pending => status == 'PENDING';

  String get statusLabel => deviceChangeStatusLabel(status);

  /// Kode alasan sebelum `:` — mis. `BROKEN`.
  String get reasonCode {
    final int idx = reason.indexOf(':');
    final String code = (idx < 0 ? reason : reason.substring(0, idx)).trim();
    return code.toUpperCase();
  }

  String get reasonLabel => deviceChangeReasonLabel(reasonCode);

  /// Catatan tambahan setelah `:`, bila karyawan mengisinya.
  String? get reasonNote {
    final int idx = reason.indexOf(':');
    if (idx < 0) return null;
    final String note = reason.substring(idx + 1).trim();
    return note.isEmpty ? null : note;
  }

  String get oldDeviceLabel => _deviceLabel(oldDeviceName, oldPlatform);

  String get newDeviceLabel => _deviceLabel(newDeviceName, newPlatform);

  factory AdminDeviceChange.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? employee = json['employee'] is Map
        ? Map<String, dynamic>.from(json['employee'] as Map)
        : null;
    final Map<String, dynamic>? oldDevice = json['oldDevice'] is Map
        ? Map<String, dynamic>.from(json['oldDevice'] as Map)
        : null;
    final Map<String, dynamic>? newDevice = json['newDevice'] is Map
        ? Map<String, dynamic>.from(json['newDevice'] as Map)
        : null;
    return AdminDeviceChange(
      id: _text(json['id']),
      employeeId: _textOrNull(json['employeeId']),
      employeeName: _text(employee?['name']),
      employeeNo: _text(employee?['employeeNo']),
      oldDeviceId: _textOrNull(json['oldDeviceId']),
      oldDeviceName: _textOrNull(oldDevice?['deviceName']),
      oldPlatform: _textOrNull(oldDevice?['platform']),
      newDeviceId: _textOrNull(json['newDeviceId']),
      newDeviceName: _textOrNull(newDevice?['deviceName']),
      newPlatform: _textOrNull(newDevice?['platform']),
      reason: _text(json['reason']),
      status: _text(json['status'], 'PENDING'),
      requestedAt: _date(json['requestedAt']),
      reviewedAt: _date(json['reviewedAt']),
      reviewNote: _textOrNull(json['reviewNote']),
    );
  }
}

String _deviceLabel(String? name, String? platform) {
  final String? deviceName = name?.trim();
  final bool hasName = deviceName != null && deviceName.isNotEmpty;
  final bool hasPlatform = platform != null && platform.isNotEmpty;
  if (!hasName && !hasPlatform) return '—';
  final String label = hasName ? deviceName : 'Tanpa nama';
  return hasPlatform ? '$label · ${devicePlatformLabel(platform)}' : label;
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
