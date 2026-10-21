// Model tim supervisor untuk layar admin Tim Supervisor.
//
// Anggota tim dipakai baik dari `GET /supervisor/team` (tanpa `days`)
// maupun dari `GET /supervisor/summary` (dengan `days` berisi status per
// tanggal). Parsing dibuat defensif karena bentuk respons backend bisa
// berubah antar versi.

/// Status satu hari kerja karyawan.
class TeamMember {
  const TeamMember({
    required this.id,
    required this.name,
    required this.employeeNo,
    this.position,
    this.departmentName = '',
    this.days = const <String, String>{},
  });

  final String id;
  final String name;
  final String employeeNo;
  final String? position;
  final String departmentName;

  /// Peta `yyyy-MM-dd` -> status (`PRESENT`, `LATE`, `ABSENT`, `ON_LEAVE`,
  /// `OFF`). Kosong untuk respons `/supervisor/team`.
  final Map<String, String> days;

  String get subtitle {
    final String dept =
        departmentName.isEmpty ? 'Tanpa Unit' : departmentName;
    if (employeeNo.isEmpty) return dept;
    return '$employeeNo Â· $dept';
  }

  int _count(String status) =>
      days.values.where((String value) => value == status).length;

  int get presentCount => _count('PRESENT');
  int get lateCount => _count('LATE');
  int get absentCount => _count('ABSENT');
  int get onLeaveCount => _count('ON_LEAVE');
  int get offCount => _count('OFF');

  /// Ringkasan satu baris untuk subtitle daftar anggota.
  String get daySummary {
    if (days.isEmpty) return '';
    return 'Hadir $presentCount Â· Terlambat $lateCount Â· Absen '
        '$absentCount Â· Off $offCount';
  }

  factory TeamMember.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> department = json['department'] is Map
        ? Map<String, dynamic>.from(json['department'] as Map)
        : const <String, dynamic>{};
    final Map<String, String> days = <String, String>{};
    final Object? rawDays = json['days'];
    if (rawDays is Map) {
      rawDays.forEach((Object? key, Object? value) {
        if (key != null && value != null) {
          days[key.toString()] = value.toString();
        }
      });
    }
    return TeamMember(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'â€”',
      employeeNo: json['employeeNo']?.toString() ?? '',
      position: json['position']?.toString(),
      departmentName: department['name']?.toString() ?? '',
      days: days,
    );
  }
}

/// Total agregat satu rentang pada `GET /supervisor/summary`.
class TeamTotals {
  const TeamTotals({
    required this.members,
    required this.present,
    required this.late,
    required this.absent,
    required this.onLeave,
  });

  final int members;
  final int present;
  final int late;
  final int absent;
  final int onLeave;

  factory TeamTotals.fromJson(Map<String, dynamic>? json) => TeamTotals(
        members: _intOf(json?['members']),
        present: _intOf(json?['present']),
        late: _intOf(json?['late']),
        absent: _intOf(json?['absent']),
        onLeave: _intOf(json?['onLeave']),
      );
}

/// Respons `GET /supervisor/summary`.
class TeamSummary {
  const TeamSummary({
    required this.from,
    required this.to,
    required this.totals,
    required this.members,
  });

  final String from;
  final String to;
  final TeamTotals totals;
  final List<TeamMember> members;

  factory TeamSummary.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawMembers =
        (json['members'] as List?) ?? const <dynamic>[];
    return TeamSummary(
      from: json['from']?.toString() ?? '',
      to: json['to']?.toString() ?? '',
      totals: TeamTotals.fromJson(
        json['totals'] is Map
            ? Map<String, dynamic>.from(json['totals'] as Map)
            : null,
      ),
      members: rawMembers
          .whereType<Map>()
          .map((Map e) => TeamMember.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

/// Satu baris presensi tim dari `GET /supervisor/attendance`.
class TeamAttendance {
  const TeamAttendance({
    required this.id,
    required this.workDate,
    required this.checkInAt,
    required this.checkOutAt,
    required this.checkInStatus,
    required this.shiftName,
    required this.employeeName,
    required this.employeeNo,
  });

  final String id;
  final DateTime? workDate;
  final DateTime? checkInAt;
  final DateTime? checkOutAt;
  final String? checkInStatus;
  final String shiftName;
  final String employeeName;
  final String employeeNo;

  factory TeamAttendance.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> employee = json['employee'] is Map
        ? Map<String, dynamic>.from(json['employee'] as Map)
        : const <String, dynamic>{};
    final Map<String, dynamic> shift = json['shift'] is Map
        ? Map<String, dynamic>.from(json['shift'] as Map)
        : const <String, dynamic>{};
    return TeamAttendance(
      id: json['id']?.toString() ?? '',
      workDate: DateTime.tryParse(json['workDate']?.toString() ?? ''),
      checkInAt: DateTime.tryParse(json['checkInAt']?.toString() ?? ''),
      checkOutAt: DateTime.tryParse(json['checkOutAt']?.toString() ?? ''),
      checkInStatus: json['checkInStatus']?.toString(),
      shiftName: shift['name']?.toString() ?? 'â€”',
      employeeName: employee['name']?.toString() ?? 'â€”',
      employeeNo: employee['employeeNo']?.toString() ?? 'â€”',
    );
  }
}

/// Respons `GET /supervisor/team/{id}`: `{member, recent}`.
class TeamMemberDetail {
  const TeamMemberDetail({required this.member, required this.recent});

  final TeamMember member;
  final List<TeamAttendance> recent;

  factory TeamMemberDetail.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> member = json['member'] is Map
        ? Map<String, dynamic>.from(json['member'] as Map)
        : const <String, dynamic>{};
    final List<dynamic> rawRecent =
        (json['recent'] as List?) ?? const <dynamic>[];
    return TeamMemberDetail(
      member: TeamMember.fromJson(member),
      recent: rawRecent
          .whereType<Map>()
          .map((Map e) => TeamAttendance.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

int _intOf(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}
