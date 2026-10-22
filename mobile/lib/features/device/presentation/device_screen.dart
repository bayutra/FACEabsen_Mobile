import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../data/device_repository.dart';
import 'device_sections.dart';





class DeviceScreen extends StatefulWidget {
  const DeviceScreen({
    super.key,
    required this.devices,
    this.displayName = 'Karyawan',
  });

  final DeviceRepository devices;
  final String displayName;

  @override
  State<DeviceScreen> createState() => _DeviceScreenState();
}

class _DeviceScreenState extends State<DeviceScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: StitchHeader(
        avatar: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primaryContainer,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.border),
          ),
          child: Center(
            child: Text(
              _initials(widget.displayName),
              style: AppText.labelMd.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        greeting: 'RS Absen',
        name: 'Perangkat Saya',
        subtitle: 'Kepegawaian • Perangkat',
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              tooltip: 'Bantuan perangkat',
              icon: const Icon(Icons.help_outline,
                  size: 22, color: AppColors.inkSecondary),
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text('Hubungi Helpdesk IT Ext. 204.')),
              ),
            ),
            IconButton(
              tooltip: 'Muat ulang',
              icon: const Icon(Icons.refresh,
                  size: 22, color: AppColors.inkSecondary),
              onPressed: () => setState(() {}),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => setState(() {}),
        child: ListView(
          padding: const EdgeInsets.all(AppColors.pageMargin),
          children: [
            const InfoBanner(
              'Akun boleh aktif di beberapa perangkat. Perangkat baru otomatis '
              'terdaftar saat Anda masuk, dan perangkat yang hilang dapat '
              'dicabut oleh Admin IT.',
              title: 'Perangkat Saya',
            ),
            const SizedBox(height: 12),
            DeviceStatusSection(
              devices: widget.devices,
              employeeName: widget.displayName,
            ),
          ],
        ),
      ),
    );
  }

  static String _initials(String name) {
    final List<String> parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '—';
    if (parts.length == 1) {
      return parts.first
          .substring(0, parts.first.length >= 2 ? 2 : 1)
          .toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }
}
