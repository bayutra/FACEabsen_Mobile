/// Tujuan navigasi dari payload notifikasi FCM.
///
/// Backend mengirim `data` berbentuk `{ type, id, status }`; `type` menentukan
/// layar yang dibuka saat notifikasi di-tap.
enum PushTarget {
  attendance,
  correction,
  leave,
  schedule,
  handover,
  device,
  unknown,
}

class PushDestination {
  const PushDestination({required this.target, this.id, this.status});

  final PushTarget target;
  final String? id;
  final String? status;

  static PushTarget _parseTarget(String? raw) {
    switch (raw) {
      case 'attendance':
      case 'presensi':
        return PushTarget.attendance;
      case 'correction':
      case 'koreksi':
        return PushTarget.correction;
      case 'leave':
      case 'cuti':
        return PushTarget.leave;
      case 'schedule':
      case 'jadwal':
        return PushTarget.schedule;
      case 'handover':
        return PushTarget.handover;
      case 'device':
      case 'perangkat':
        return PushTarget.device;
      default:
        return PushTarget.unknown;
    }
  }

  static PushDestination fromData(Map<String, dynamic> data) {
    final String? type = data['type']?.toString();
    return PushDestination(
      target: _parseTarget(type),
      id: data['id']?.toString(),
      status: data['status']?.toString(),
    );
  }
}
