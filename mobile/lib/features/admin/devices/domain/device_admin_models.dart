
class AdminDevice {
  const AdminDevice({
    required this.id,
    required this.status,
    required this.platform,
    required this.employeeName,
    required this.employeeNo,
    this.deviceName,
    this.appVersion,
    this.installationId,
    this.registeredAt,
    this.lastSeenAt,
    this.revokeReason,
  });

  final String id;
  final String status;
  final String platform;
  final String employeeName;
  final String employeeNo;
  final String? deviceName;
  final String? appVersion;
  final String? installationId;
  final DateTime? registeredAt;
  final DateTime? lastSeenAt;
  final String? revokeReason;

  bool get pending => status == 'PENDING';

  factory AdminDevice.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? employee =
        json['employee'] is Map ? Map<String, dynamic>.from(json['employee'] as Map) : null;
    return AdminDevice(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'UNKNOWN',
      platform: json['platform'] as String? ?? '—',
      employeeName: employee?['name'] as String? ?? '—',
      employeeNo: employee?['employeeNo'] as String? ?? '—',
      deviceName: json['deviceName'] as String?,
      appVersion: json['appVersion'] as String?,
      installationId: json['installationId'] as String?,
      registeredAt: DateTime.tryParse(json['registeredAt'] as String? ?? ''),
      lastSeenAt: DateTime.tryParse(json['lastSeenAt'] as String? ?? ''),
      revokeReason: json['revokeReason'] as String?,
    );
  }
}

class AdminDevicePage {
  const AdminDevicePage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.totalItems,
  });

  final List<AdminDevice> items;
  final int page;
  final int totalPages;
  final int totalItems;
}
