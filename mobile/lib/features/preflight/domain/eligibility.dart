




library;

import '../../schedule/data/schedule_repository.dart';
import '../../schedule/domain/shift_status.dart';

enum GateId { account, schedule }

enum GateState { pass, warn, fail }

class GateResult {
  const GateResult({
    required this.id,
    required this.title,
    required this.badge,
    required this.state,
    required this.detail,
    this.chips = const [],
  });

  final GateId id;
  final String title;
  final String badge;
  final GateState state;
  final String detail;
  final List<String> chips;
}

GateResult evaluateAccount({required bool isActive, required bool hasProfile}) {
  if (!hasProfile) {
    return const GateResult(
      id: GateId.account,
      title: 'Perangkat Terdaftar',
      badge: 'Tidak Ditemukan',
      state: GateState.fail,
      detail: 'Akun ini belum terhubung ke data karyawan.',
    );
  }
  return GateResult(
    id: GateId.account,
    title: 'Perangkat Terdaftar',
    badge: isActive ? 'Aktif' : 'Nonaktif',
    state: isActive ? GateState.pass : GateState.fail,
    detail: isActive
        ? 'Akun aktif dan terhubung ke data karyawan.'
        : 'Akun dinonaktifkan. Hubungi admin SDM.',
    chips: isActive ? const ['ID Terdaftar', 'Role valid'] : const [],
  );
}

GateResult evaluateSchedule({
  required bool hasShift,
  String? window,
  String? name,
  ScheduleEntry? shift,
  DateTime? now,
}) {
  if (!hasShift) {
    return const GateResult(
      id: GateId.schedule,
      title: 'Jadwal Shift Dinas',
      badge: 'Tidak Ada Jadwal',
      state: GateState.fail,
      detail: 'Belum ada roster hari ini, presensi tidak dapat dicatat.',
    );
  }
  final String roster = '${name ?? 'Shift'} · ${window ?? '—'}';
  if (shift == null || now == null) {
    return GateResult(
      id: GateId.schedule,
      title: 'Jadwal Shift Dinas',
      badge: 'Tepat Waktu',
      state: GateState.pass,
      detail: roster,
    );
  }
  
  
  
  final ShiftVerdict punch = shift.checkInStatusAt(now);
  switch (punch.status) {
    case PunchStatus.late:
      return GateResult(
        id: GateId.schedule,
        title: 'Jadwal Shift Dinas',
        badge: 'Terlambat',
        state: GateState.warn,
        detail: 'Terlambat ${punch.minutes} mnt (toleransi ${shift.gracePeriodMin} mnt).',
      );
    case PunchStatus.veryLate:
      return GateResult(
        id: GateId.schedule,
        title: 'Jadwal Shift Dinas',
        badge: 'Sangat Terlambat',
        state: GateState.warn,
        detail: 'Terlambat ${punch.minutes} mnt, ambang telat ${shift.lateThresholdMin} mnt terlampaui.',
      );
    default:
      return GateResult(
        id: GateId.schedule,
        title: 'Jadwal Shift Dinas',
        badge: 'Tepat Waktu',
        state: GateState.pass,
        detail: '$roster · Toleransi ${shift.gracePeriodMin} mnt · Ambang telat ${shift.lateThresholdMin} mnt',
      );
  }
}


bool canProceed(List<GateResult> gates) =>
    !gates.any((GateResult g) => g.state == GateState.fail);

int passedCount(List<GateResult> gates) =>
    gates.where((GateResult g) => g.state == GateState.pass).length;



bool isBlocking(GateResult g) => switch (g.id) {
      GateId.schedule || GateId.account => true,
    };


List<GateResult> blockingGates(List<GateResult> gates) =>
    gates.where(isBlocking).where((GateResult g) => g.state == GateState.fail).toList();
