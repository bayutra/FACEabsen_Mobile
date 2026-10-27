import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/presentation/attendance_screen.dart';
import '../../device/domain/device_models.dart' show formatIdDateTime;
import '../../face/data/face_repository.dart';
import '../../device/data/device_repository.dart';

class FaceRegisteredScreen extends StatelessWidget {
  const FaceRegisteredScreen({
    super.key,
    required this.version,
    required this.qualityScore,
    required this.employeeNo,
    required this.displayName,
    required this.attendance,
    required this.faces,
    required this.devices,
    this.registeredAt,
  });

  final int version;
  final double qualityScore;
  final String employeeNo;
  final String displayName;
  final AttendanceRepository attendance;
  final FaceRepository faces;
  final DeviceRepository devices;

  final DateTime? registeredAt;

  void _goAttendance(BuildContext context, {bool popFirst = true}) {
    if (popFirst) Navigator.of(context).popUntil((r) => r.isFirst);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AttendanceScreen(
          attendance: attendance,
          faces: faces,
          devices: devices,
          displayName: displayName,
          employeeNo: employeeNo,
        ),
      ),
    );
  }

  Future<void> _showPrivacy(BuildContext context) async {
    try {
      final notice = await faces.fetchNotice();
      if (!context.mounted) return;
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(notice.title),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Versi ${notice.version}',
                    style: const TextStyle(
                        color: AppColors.inkSecondary, fontSize: 12)),
                const SizedBox(height: 8),
                Text(notice.body, style: const TextStyle(fontSize: 14)),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Tutup'),
            ),
          ],
        ),
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
        ),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Registrasi Wajah', style: TextStyle(fontSize: 16)),
            Text('Layanan SIMRS Mobile',
                style: TextStyle(fontSize: 11, color: AppColors.inkSecondary)),
          ],
        ),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 12),
            child: Center(
              child: _Pill(
                '3/3 Selesai',
                AppColors.tealBadgeBg,
                AppColors.tealBadgeText,
                icon: Icons.check_circle,
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: [
          _hero(),
          const SizedBox(height: 18),
          const Center(
            child: Text(
              'Pendaftaran Wajah Berhasil!',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w700, height: 36 / 28),
            ),
          ),
          const SizedBox(height: 6),
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'Data biometrik Anda telah terverifikasi dan terikat dengan ID '
                'Karyawan & Perangkat resmi RSU Darmayu Madiun.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.inkSecondary),
              ),
            ),
          ),
          const SizedBox(height: 18),
          _receipt(),
          const SizedBox(height: 14),
          const _PrivacyNote(),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => _goAttendance(context),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Masuk ke Beranda Presensi'),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton.icon(
                onPressed: () => _goAttendance(context, popFirst: false),
                icon: const Icon(Icons.face, size: 16),
                label: const Text('Uji Coba Presensi Wajah',
                    style: TextStyle(fontSize: 12)),
              ),
              TextButton.icon(
                onPressed: () => _showPrivacy(context),
                icon: const Icon(Icons.info_outline, size: 16),
                label: const Text('Informasi Privasi & SPO',
                    style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _hero() => Center(
        child: Column(
          children: [
            SizedBox(
              width: 132,
              height: 132,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 128,
                    height: 128,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.tealBadgeBg,
                      border: Border.all(color: AppColors.primary, width: 3),
                    ),
                    child: const Icon(Icons.face,
                        size: 62, color: AppColors.primary),
                  ),
                  Positioned(
                    right: 8,
                    bottom: 8,
                    child: Container(
                      padding: const EdgeInsets.all(5),
                      decoration: const BoxDecoration(
                        color: AppColors.success,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check,
                          size: 18, color: Colors.white),
                    ),
                  ),
                  Positioned(
                    left: 0,
                    bottom: 4,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Icon(Icons.photo_camera_outlined,
                          size: 16, color: AppColors.inkSecondary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const _Pill(
              'Validasi SIMRS Berhasil',
              AppColors.successTint,
              AppColors.successText,
              icon: Icons.task_alt,
            ),
            const SizedBox(height: 8),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.verified_user, size: 13, color: AppColors.primary),
                SizedBox(width: 5),
                Text('Template Terdaftar',
                    style:
                        TextStyle(fontSize: 11, color: AppColors.inkSecondary)),
              ],
            ),
          ],
        ),
      );

  Widget _receipt() => AppCard(
        child: Column(
          children: [
            Row(
              children: [
                const Icon(Icons.badge_outlined,
                    size: 18, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('NIP / ID Karyawan',
                          style: TextStyle(
                              fontSize: 10, color: AppColors.inkSecondary)),
                      Text(employeeNo,
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w700)),
                      Text(displayName,
                          style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            _qualityRow(),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.lock_outline,
                    size: 16, color: AppColors.inkSecondary),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('Status Enkripsi',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.inkSecondary)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.canvas,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 6,
                        height: 6,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: AppColors.success,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      SizedBox(width: 6),
                      Text('SIMRS (AES-256)',
                          style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.schedule,
                    size: 16, color: AppColors.inkSecondary),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text('Tanggal Registrasi',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.inkSecondary)),
                ),
                Text(
                  registeredAt != null ? formatIdDateTime(registeredAt!) : '—',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ],
        ),
      );

  Widget _qualityRow() {
    final String pct = '${(qualityScore * 100).toStringAsFixed(1)}%';
    return Row(
      children: [
        const Icon(Icons.fingerprint, size: 16, color: AppColors.primary),
        const SizedBox(width: 10),
        const Expanded(
          child: Text('Kualitas Biometrik',
              style: TextStyle(fontSize: 12, color: AppColors.inkSecondary)),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('Skor Akurasi $pct',
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary)),
            Text('(${_qualitySubline(qualityScore)})',
                style: const TextStyle(
                    fontSize: 11, color: AppColors.inkSecondary)),
          ],
        ),
      ],
    );
  }

  static String _qualitySubline(double q) {
    if (q >= 0.9) return 'Optimal';
    if (q >= 0.8) return 'Sangat Baik';
    if (q >= 0.7) return 'Baik';
    if (q >= 0.6) return 'Cukup';
    return 'Perlu Diperbaiki';
  }
}

class _PrivacyNote extends StatelessWidget {
  const _PrivacyNote();

  @override
  Widget build(BuildContext context) => const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shield_outlined, size: 16, color: AppColors.primary),
          SizedBox(width: 8),
          Flexible(
            child: Text(
              'Sesuai standar privasi data rekam medis & Permenkes RI',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: AppColors.inkSecondary),
            ),
          ),
        ],
      );
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, this.bg, this.fg, {this.icon});
  final String label;
  final Color bg;
  final Color fg;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => AppPill(
        label,
        bg,
        fg,
        icon: icon,
        border:
            bg == AppColors.card ? AppColors.border : AppColors.tealBadgeBorder,
      );
}
