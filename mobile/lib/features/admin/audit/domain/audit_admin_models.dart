/// Model entitas audit untuk layar admin SUPER_ADMIN.
class AdminAuditLog {
  const AdminAuditLog({
    required this.id,
    required this.actorId,
    required this.action,
    required this.result,
    this.actorEmail,
    this.targetType,
    this.targetId,
    this.timestamp,
    this.ipAddress,
    this.deviceId,
    this.metadata,
  });

  final String id;
  final String actorId;
  final String action;
  final String? actorEmail;
  final String? targetType;
  final String? targetId;
  final DateTime? timestamp;
  final String? ipAddress;
  final String? deviceId;
  final Map<String, dynamic>? metadata;
  final String result;

  /// Label target ringkas untuk daftar (`LOGIN · EMP-001`).
  String get targetSummary {
    final String? t = targetType;
    final String? id = targetId;
    if (t == null && id == null) return '—';
    if (t != null && id != null) {
      final String short = id.length > 10 ? '${id.substring(0, 10)}…' : id;
      return '$t · $short';
    }
    return t ?? id!;
  }

  /// Label aktor: email bila ada, bila tidak ID mentah.
  String get actorLabel {
    final String? email = actorEmail;
    if (email != null && email.isNotEmpty) return email;
    return actorId.length > 18 ? '${actorId.substring(0, 18)}…' : actorId;
  }

  factory AdminAuditLog.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? actor =
        json['actor'] is Map ? Map<String, dynamic>.from(json['actor'] as Map) : null;
    final Map<String, dynamic>? meta =
        json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata'] as Map) : null;
    return AdminAuditLog(
      id: json['id'] as String,
      actorId: json['actorId'] as String? ?? '',
      action: json['action'] as String? ?? '—',
      actorEmail: actor?['email'] as String?,
      targetType: json['targetType'] as String?,
      targetId: json['targetId'] as String?,
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? ''),
      ipAddress: json['ipAddress'] as String?,
      deviceId: json['deviceId'] as String?,
      metadata: meta,
      result: json['result'] as String? ?? 'UNKNOWN',
    );
  }
}

class AdminAuditPage {
  const AdminAuditPage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.totalItems,
  });

  final List<AdminAuditLog> items;
  final int page;
  final int totalPages;
  final int totalItems;
}
