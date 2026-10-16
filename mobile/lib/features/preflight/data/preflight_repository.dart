import '../../location/data/location_repository.dart';
import '../../location/domain/geo_models.dart';
import '../../profile/data/profile_repository.dart';
import '../../schedule/data/schedule_repository.dart';

/// Everything the pre-flight screen needs, fetched in parallel.
class PreflightSnapshot {
  const PreflightSnapshot({
    required this.displayName,
    required this.employeeNo,
    required this.department,
    required this.isActive,
    required this.hasProfile,
    required this.fix,
    required this.geo,
    required this.shift,
  });

  final String displayName;
  final String employeeNo;
  final String department;
  final bool isActive;
  final bool hasProfile;
  final GeoFix? fix;
  final GeofenceResult? geo;
  final ScheduleEntry? shift;
}

/// Loads identity + location + roster for the pre-flight gate.
class PreflightRepository {
  PreflightRepository({
    required LocationRepository locations,
    required ProfileRepository profiles,
    required ScheduleRepository schedules,
  })  : _locations = locations,
        _profiles = profiles,
        _schedules = schedules;

  final LocationRepository _locations;
  final ProfileRepository _profiles;
  final ScheduleRepository _schedules;

  Future<PreflightSnapshot> load({bool captureLocation = true}) async {
    final DateTime now = DateTime.now();
    final DateTime monday = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));

    // Identity first: if it fails we still want the rest of the gates to show.
    String name = 'Karyawan';
    String nip = 'â€”';
    String dept = 'â€”';
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
      // Left at defaults; the account gate reports the failure.
    }

    GeoFix? fix;
    GeofenceResult? geo;
    if (captureLocation) {
      try {
        fix = await _locations.getFix();
        geo = await _locations.checkGeofence(fix);
      } catch (_) {
        // Absence of a verdict is itself a gate outcome.
      }
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
      // Treated as "no roster" by the schedule gate.
    }

    return PreflightSnapshot(
      displayName: name,
      employeeNo: nip,
      department: dept,
      isActive: active,
      hasProfile: hasProfile,
      fix: fix,
      geo: geo,
      shift: shift,
    );
  }
}
