import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../audit/presentation/audit_admin_screen.dart';
import '../corrections/presentation/correction_admin_screen.dart';
import '../departments/presentation/department_admin_screen.dart';
import '../device_change/presentation/device_change_admin_screen.dart';
import '../devices/presentation/device_admin_screen.dart';
import '../domain/admin_access.dart';
import '../employees/presentation/employee_admin_screen.dart';
import '../leaves/presentation/leave_admin_screen.dart';
import '../privacy/presentation/privacy_admin_screen.dart';
import '../reports/presentation/report_admin_screen.dart';
import '../schedules/presentation/schedule_admin_screen.dart';
import '../shifts/presentation/shift_admin_screen.dart';
import '../supervisor/presentation/team_admin_screen.dart';
import '../users/presentation/user_admin_screen.dart';
import 'admin_widgets.dart';

/// Beranda area "Kelola": daftar modul admin sesuai peran pengguna.
///
/// Tiap modul memanggil endpoint yang sama dengan SIMRS, jadi tidak ada
/// logika bisnis yang diduplikasi di aplikasi. Peran yang tidak berhak tidak
/// pernah melihat modulnya.
class AdminHomeScreen extends StatelessWidget {
  const AdminHomeScreen({super.key, required this.dio, required this.roles});

  final Dio dio;
  final List<String> roles;

  String get _roleLabel {
    if (isSuperAdmin(roles)) return 'Super Admin';
    if (roles.contains(roleAdmin)) return 'Admin';
    return 'Supervisor';
  }

  List<Widget> _buildSection(BuildContext context, String title, List<Widget> tiles) {
    if (tiles.isEmpty) return const <Widget>[];
    return <Widget>[
      SectionHeader(title),
      for (final Widget tile in tiles) ...<Widget>[
        tile,
        const SizedBox(height: 8),
      ],
      const SizedBox(height: 8),
    ];
  }

  List<Widget> _sdm(BuildContext context) {
    if (!isAdmin(roles)) return const <Widget>[];
    return <Widget>[
      AdminTile(
        icon: Icons.badge_outlined,
        title: 'Karyawan',
        subtitle: 'Tambah, ubah, dan nonaktifkan akun karyawan',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => EmployeeAdminScreen(dio: dio),
          ),
        ),
      ),
      AdminTile(
        icon: Icons.account_tree_outlined,
        title: 'Departemen',
        subtitle: 'Kelola unit kerja di rumah sakit',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => DepartmentAdminScreen(dio: dio),
          ),
        ),
      ),
      AdminTile(
        icon: Icons.schedule,
        title: 'Shift',
        subtitle: 'Jam kerja, toleransi keterlambatan, dan lintas hari',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ShiftAdminScreen(dio: dio),
          ),
        ),
      ),
      AdminTile(
        icon: Icons.calendar_month_outlined,
        title: 'Jadwal',
        subtitle: 'Atur penugasan shift per karyawan per tanggal',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ScheduleAdminScreen(dio: dio),
          ),
        ),
      ),
    ];
  }

  List<Widget> _approval(BuildContext context) {
    if (!isSupervisor(roles)) return const <Widget>[];
    return <Widget>[
      AdminTile(
        icon: Icons.fact_check_outlined,
        title: 'Koreksi Presensi',
        subtitle: 'Tinjau permintaan perbaikan jam masuk/pulang',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => CorrectionAdminScreen(dio: dio),
          ),
        ),
      ),
      AdminTile(
        icon: Icons.beach_access_outlined,
        title: 'Cuti & Izin',
        subtitle: 'Persetujuan pengajuan cuti, sakit, dan dinas',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => LeaveAdminScreen(dio: dio),
          ),
        ),
      ),
    ];
  }

  List<Widget> _reports(BuildContext context) {
    if (!isSupervisor(roles)) return const <Widget>[];
    return <Widget>[
      AdminTile(
        icon: Icons.insights_outlined,
        title: 'Laporan',
        subtitle: 'Rekap kehadiran harian, bulanan, dan per departemen',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ReportAdminScreen(dio: dio),
          ),
        ),
      ),
      AdminTile(
        icon: Icons.groups_outlined,
        title: 'Tim Supervisor',
        subtitle: 'Ringkasan kehadiran tim dan presensi terbaru',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => TeamAdminScreen(dio: dio),
          ),
        ),
      ),
    ];
  }

  List<Widget> _operations(BuildContext context) {
    final List<Widget> items = <Widget>[];
    if (isSuperAdmin(roles)) {
      items.addAll(<Widget>[
        AdminTile(
          icon: Icons.devices_other,
          title: 'Perangkat',
          subtitle: 'Aktivasi perangkat baru, cabut akses, tandai hilang',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => DeviceAdminScreen(dio: dio),
            ),
          ),
        ),
        AdminTile(
          icon: Icons.swap_horiz,
          title: 'Penggantian Perangkat',
          subtitle: 'Permintaan pindah perangkat karyawan',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => DeviceChangeAdminScreen(dio: dio),
            ),
          ),
        ),
      ]);
    }
    return items;
  }

  List<Widget> _security(BuildContext context) {
    if (!isSuperAdmin(roles)) return const <Widget>[];
    return <Widget>[
      AdminTile(
        icon: Icons.receipt_long_outlined,
        title: 'Audit Log',
        subtitle: 'Jejak seluruh aksi penting di sistem',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => AuditAdminScreen(dio: dio),
          ),
        ),
      ),
      AdminTile(
        icon: Icons.manage_accounts_outlined,
        title: 'Pengguna',
        subtitle: 'Akun, peran, dan reset password',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => UserAdminScreen(dio: dio),
          ),
        ),
      ),
      AdminTile(
        icon: Icons.privacy_tip_outlined,
        title: 'Privasi & Retensi',
        subtitle: 'Pemberitahuan privasi dan penjadwalan pembersihan data',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => PrivacyAdminScreen(dio: dio),
          ),
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Kelola',
      subtitle: 'Masuk sebagai $_roleLabel',
      child: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          const InfoBanner(
            'Semua aksi di sini tercatat di audit log SIMRS. Perubahan '
            'langsung berlaku pada perangkat karyawan.',
            tone: InfoBannerTone.info,
            title: 'Area administrator',
          ),
          const SizedBox(height: 16),
          ..._buildSection(context, 'SDM', _sdm(context)),
          ..._buildSection(context, 'PERSETUJUAN', _approval(context)),
          ..._buildSection(context, 'LAPORAN', _reports(context)),
          ..._buildSection(context, 'OPERASIONAL', _operations(context)),
          ..._buildSection(context, 'KEAMANAN & AUDIT', _security(context)),
        ],
      ),
    );
  }
}
