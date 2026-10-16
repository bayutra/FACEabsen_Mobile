/// Device binding domain (pure — unit tested).
enum DeviceStatus { pending, active, revoked, lost, replaced, unknown }

DeviceStatus deviceStatusFrom(String? raw) {
  switch (raw) {
    case 'PENDING':
      return DeviceStatus.pending;
    case 'ACTIVE':
      return DeviceStatus.active;
    case 'REVOKED':
      return DeviceStatus.revoked;
    case 'LOST':
      return DeviceStatus.lost;
    case 'REPLACED':
      return DeviceStatus.replaced;
    default:
      return DeviceStatus.unknown;
  }
}

String deviceStatusLabel(DeviceStatus status) {
  switch (status) {
    case DeviceStatus.pending:
      return 'Menunggu aktivasi';
    case DeviceStatus.active:
      return 'Aktif';
    case DeviceStatus.revoked:
      return 'Dicabut';
    case DeviceStatus.lost:
      return 'Hilang';
    case DeviceStatus.replaced:
      return 'Diganti';
    case DeviceStatus.unknown:
      return 'Tidak diketahui';
  }
}

class BoundDevice {
  BoundDevice({
    required this.id,
    required this.installationId,
    required this.platform,
    required this.status,
    this.deviceName,
    this.appVersion,
    this.registeredAt,
    this.lastSeenAt,
  });

  final String id;
  final String installationId;
  final String platform;
  final DeviceStatus status;
  final String? deviceName;
  final String? appVersion;
  final DateTime? registeredAt;
  final DateTime? lastSeenAt;

  factory BoundDevice.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(Object? v) =>
        v is String ? DateTime.tryParse(v) : null;
    return BoundDevice(
      id: json['id'] as String,
      installationId: json['installationId'] as String? ?? '',
      platform: json['platform'] as String? ?? '',
      status: deviceStatusFrom(json['status'] as String?),
      deviceName: json['deviceName'] as String?,
      appVersion: json['appVersion'] as String?,
      registeredAt: parseDate(json['registeredAt']),
      lastSeenAt: parseDate(json['lastSeenAt']),
    );
  }
}

/// Replacement request status (PRD §11.4).
enum ChangeRequestStatus { pending, approved, rejected, cancelled, unknown }

ChangeRequestStatus changeRequestStatusFrom(String? raw) {
  switch (raw) {
    case 'PENDING':
      return ChangeRequestStatus.pending;
    case 'APPROVED':
      return ChangeRequestStatus.approved;
    case 'REJECTED':
      return ChangeRequestStatus.rejected;
    case 'CANCELLED':
      return ChangeRequestStatus.cancelled;
    default:
      return ChangeRequestStatus.unknown;
  }
}

String changeRequestStatusLabel(ChangeRequestStatus status) {
  switch (status) {
    case ChangeRequestStatus.pending:
      return 'Menunggu admin';
    case ChangeRequestStatus.approved:
      return 'Disetujui';
    case ChangeRequestStatus.rejected:
      return 'Ditolak';
    case ChangeRequestStatus.cancelled:
      return 'Dibatalkan';
    case ChangeRequestStatus.unknown:
      return 'Tidak diketahui';
  }
}

class ChangeRequest {
  ChangeRequest({
    required this.id,
    required this.status,
    required this.reason,
    this.reviewNote,
    this.requestedAt,
    this.reviewedAt,
    this.reviewedBy,
    this.oldDevice,
    this.newDevice,
  });

  final String id;
  final ChangeRequestStatus status;
  final String reason;
  final String? reviewNote;

  /// Real backend timestamps (`device_change_requests.requested_at /
  /// reviewed_at`). Null when the payload predates them — callers must omit
  /// date rows rather than invent dates.
  final DateTime? requestedAt;
  final DateTime? reviewedAt;
  final String? reviewedBy;

  /// Embedded devices from `listMine` / `request` (`include: old/newDevice`).
  /// Null when the payload omits them — callers must omit device rows.
  final BoundDevice? oldDevice;
  final BoundDevice? newDevice;

  factory ChangeRequest.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(Object? v) => v is String ? DateTime.tryParse(v) : null;
    BoundDevice? parseDevice(Object? v) {
      if (v is! Map) return null;
      try {
        return BoundDevice.fromJson(Map<String, dynamic>.from(v));
      } catch (_) {
        return null;
      }
    }

    return ChangeRequest(
      id: json['id'] as String,
      status: changeRequestStatusFrom(json['status'] as String?),
      reason: json['reason'] as String? ?? '',
      reviewNote: json['reviewNote'] as String?,
      requestedAt: parseDate(json['requestedAt']),
      reviewedAt: parseDate(json['reviewedAt']),
      reviewedBy: json['reviewedBy'] as String? ?? json['reviewer'] as String?,
      oldDevice: parseDevice(json['oldDevice']),
      newDevice: parseDevice(json['newDevice']),
    );
  }
}

/// Short public ticket fragment: `#` + first 8 chars of the real request id.
/// Never a fictional `DEV-REQ-…` sequence.
String shortTicketId(String id) => '#${id.length <= 8 ? id : id.substring(0, 8)}';

/// Short device fragment for rows where the full install id would overflow.
String shortDeviceId(String id) => id.length <= 8 ? id : id.substring(0, 8);

const List<String> _idMonths = <String>[
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

String _two(int v) => v.toString().padLeft(2, '0');

/// Indonesian clinical timestamp, e.g. `24 Okt 2024, 08:15 WIB`.
/// Pure — no `intl` dependency required.
String formatIdDateTime(DateTime dt) {
  final DateTime l = dt.toLocal();
  final String mon = (l.month >= 1 && l.month <= 12) ? _idMonths[l.month] : '';
  return '${l.day} $mon ${l.year}, ${_two(l.hour)}:${_two(l.minute)} WIB';
}

/// Indonesian short date, e.g. `24 Okt 2024`.
String formatIdDate(DateTime dt) {
  final DateTime l = dt.toLocal();
  final String mon = (l.month >= 1 && l.month <= 12) ? _idMonths[l.month] : '';
  return '${l.day} $mon ${l.year}';
}
