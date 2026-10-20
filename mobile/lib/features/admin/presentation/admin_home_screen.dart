import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../devices/presentation/device_admin_screen.dart';
import '../domain/admin_access.dart';
import '../employees/presentation/employee_admin_screen.dart';
import 'admin_widgets.dart';

/// Beranda area "Kelola": daftar modul admin sesuai peran pengguna.
///
/// Setiap modul memanggil endpoint yang sama dengan SIMRS, jadi tidak ada
/// logika bisnis yang diduplikasi di aplikasi.
class AdminHomeScreen extends StatelessWidget {
  const AdminHomeScreen({super.key, required this.dio, required this.roles});

  final Dio dio;
  final List<String> roles;

  String get _roleLabel {
    if (isSuperAdmin(roles)) return 'Super Admin';
    if (roles.contains(roleAdmin)) return 'Admin';
    return 'Supervisor';
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
    ];
  }

  List<Widget> _operasional(BuildContext context) {
    final List<Widget> items = <Widget>[];
    if (isSuperAdmin(roles)) {
      items.add(AdminTile(
        icon: Icons.devices_other,
        title: 'Perangkat',
        subtitle: 'Aktivasi perangkat baru, cabut akses, tandai hilang',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => DeviceAdminScreen(dio: dio),
          ),
        ),
      ));
    }
    return items;
  }

  List<Widget> _buildSection(
    BuildContext context,
    String title,
    List<Widget> tiles,
  ) {
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
          ..._buildSection(context, 'OPERASIONAL', _operasional(context)),
        ],
      ),
    );
  }
}
