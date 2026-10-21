import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';

/// Stitch `daftarkan_perangkat` — stepper 1 Login done, 2 Perangkat aktif,
/// 3 Wajah upcoming. Nav disuppress, footer sticky.
class DeviceRegisterScreen extends StatelessWidget {
  const DeviceRegisterScreen({
    super.key,
    this.deviceName = 'Samsung A54',
    this.deviceModel = 'SM-A546E',
    this.osLabel = 'Android 14 • SIMRS v2.4.0',
    this.deviceId = '8F2A-41BC-9D07',
    this.ownerName = 'Ns. Siti Rahma, S.Kep',
    this.onContinue,
    this.onUseOther,
    this.onRequestReplacement,
  });

  final String deviceName;
  final String deviceModel;
  final String osLabel;
  final String deviceId;
  final String ownerName;
  final VoidCallback? onContinue;
  final VoidCallback? onUseOther;

  /// Dibuka saat HP ini masih PENDING: ajukan HP ini sebagai pengganti
  /// perangkat aktif lama (butuh password + persetujuan admin).
  /// Null = sembunyikan tombol (mis. konteks tanpa sesi login).
  final VoidCallback? onRequestReplacement;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.canvas,
        appBar: StitchHeader(
          title: 'Daftarkan Perangkat',
          subtitle: 'RS ABSEN SIMRS • Langkah 2 dari 3',
          onBack: () => Navigator.of(context).pop(),
          trailing: const Icon(Icons.help_outline,
              color: AppColors.inkSecondary),
        ),
        body: ListView(
          padding: const EdgeInsets.all(AppColors.pageMargin),
          children: [
            const StitchStepper(
              steps: ['Login', 'Perangkat', 'Wajah'],
              current: 1,
            ),
            const SizedBox(height: 12),
            AppCard(
              accent: AppColors.primaryContainer,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLow,
                          borderRadius: BorderRadius.circular(
                              AppColors.radiusInput),
                          border:
                              Border.all(color: AppColors.border),
                        ),
                        child: const Icon(Icons.phone_android,
                            color: AppColors.primaryContainer),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment:
                              CrossAxisAlignment.start,
                          children: [
                            Text(deviceName,
                                style: AppText.bodyMdMedium),
                            Text(deviceModel,
                                style: AppText.labelSm),
                          ],
                        ),
                      ),
                      const AppPill(
                        'Menunggu Verifikasi',
                        AppColors.warningTint,
                        AppColors.warningText,
                        border: AppColors.warningBorder,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DetailRow('Sistem', osLabel),
                  DetailRow('UUID', deviceId, isTime: true),
                  DetailRow('Pemilik', ownerName),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const InfoBanner(
              'Akun boleh dipakai di lebih dari satu perangkat. Perangkat yang dipakai akan terdaftar otomatis untuk presensi.',
              title: 'Kebijakan Multi-Perangkat',
            ),
            const SizedBox(height: 8),
            const AppCard(
              child: Column(
                children: [
                  DetailRow('IMEI', 'Terverifikasi operator'),
                  DetailRow('Kamera', 'Biometrik tersedia'),
                ],
              ),
            ),
            const SizedBox(height: 90),
          ],
        ),
        bottomNavigationBar: SafeArea(
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            decoration: const BoxDecoration(
              color: AppColors.surfaceLowest,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: AppColors.buttonHeight,
                  child: FilledButton.icon(
                    onPressed: onContinue ??
                        () => Navigator.of(context).pop(true),
                    icon: const Icon(Icons.arrow_forward, size: 20),
                    label: const Text('Lanjutkan'),
                  ),
                ),
                const SizedBox(height: 8),
                if (onRequestReplacement != null)
                  SizedBox(
                    height: AppColors.ghostHeight,
                    child: OutlinedButton.icon(
                      onPressed: onRequestReplacement,
                      icon: const Icon(Icons.swap_horiz, size: 20),
                      label: const Text('Ajukan HP Ini sebagai Pengganti'),
                    ),
                  ),
                if (onRequestReplacement != null) const SizedBox(height: 8),
                SizedBox(
                  height: AppColors.ghostHeight,
                  child: OutlinedButton(
                    onPressed: onUseOther ??
                        () => Navigator.of(context).pop(false),
                    child: const Text('Gunakan Perangkat Lain'),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.lock,
                        size: 14, color: AppColors.inkSecondary),
                    const SizedBox(width: 4),
                    Text('SHA-256 • SIMRS Secure Binding',
                        style: AppText.labelSm.copyWith(
                            color: AppColors.inkSecondary)),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
}
