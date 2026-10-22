import '../../profile/data/profile_repository.dart';
import '../../schedule/data/schedule_repository.dart';


class PreflightSnapshot {
  const PreflightSnapshot({
    required this.displayName,
    required this.employeeNo,
    required this.department,
    required this.isActive,
    required this.hasProfile,
    required this.shift,
  });

  final String displayName;
  final String employeeNo;
  final String department;
  final bool isActive;
  final bool hasProfile;
  final ScheduleEntry? shift;
}


class PreflightRepository {
  PreflightRepository({
    required ProfileRepository profiles,
    required ScheduleRepository schedules,
  })  : _profiles = profiles,
        _schedules = schedules;

  final ProfileRepository _profiles;
  final ScheduleRepository _schedules;

  Future<PreflightSnapshot> load() async {
    final DateTime now = DateTime.now();
    final DateTime monday = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));

    String name = 'Karyawan';
    String nip = '—';
    String dept = '—';
    bool active = true;
    bool hasProfile = false;
    try {
      final ProfileSnapshot p = await _profiles.load();
      name = p.name;
      nip = p.employeeNo;
      dept = p.department;
      active = p.isActive;
      hasProfile = true;
    } catch (_) {
      
    }

    ScheduleEntry? shift;
    try {
      final List<ScheduleEntry> week = await _schedules.mySchedule(
        from: monday,
        to: monday.add(const Duration(days: 6)),
      );
      for (final ScheduleEntry e in week) {
        if (e.workDate.year == now.year &&
            e.workDate.month == now.month &&
            e.workDate.day == now.day) {
          shift = e;
          break;
        }
      }
    } catch (_) {
      
    }

    return PreflightSnapshot(
      displayName: name,
      employeeNo: nip,
      department: dept,
      isActive: active,
      hasProfile: hasProfile,
      shift: shift,
    );
  }
}
