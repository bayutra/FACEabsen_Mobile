import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'app_config_repository.dart';

class AppUpdateScreen extends StatelessWidget {
  const AppUpdateScreen({
    super.key,
    required this.status,
    required this.onRetry,
  });

  final AppUpdateStatus status;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.system_update,
                    size: 36,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Pembaruan Aplikasi Diperlukan',
                  textAlign: TextAlign.center,
                  style: AppText.headlineSm.copyWith(color: AppColors.ink),
                ),
                const SizedBox(height: 8),
                Text(
                  status.message,
                  textAlign: TextAlign.center,
                  style: AppText.bodyMd.copyWith(color: AppColors.inkSecondary),
                ),
                const SizedBox(height: 20),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLowest,
                    borderRadius: BorderRadius.circular(AppColors.radiusCard),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: <Widget>[
                      _row('Versi terpasang', status.currentVersion),
                      const SizedBox(height: 8),
                      _row('Versi minimal', status.minVersion),
                      const SizedBox(height: 8),
                      _row('Versi terbaru', status.latestVersion),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: AppColors.buttonHeight,
                  child: FilledButton.icon(
                    onPressed: () => onRetry(),
                    icon: const Icon(Icons.refresh, size: 20),
                    label: const Text('Coba Lagi'),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Hubungi admin IT rumah sakit jika pembaruan belum tersedia.',
                  textAlign: TextAlign.center,
                  style: AppText.labelSm.copyWith(color: AppColors.outline),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Text(
            label,
            style: AppText.labelMd.copyWith(color: AppColors.inkSecondary),
          ),
        ),
        Text(
          value,
          style: AppText.labelMd.copyWith(
            color: AppColors.ink,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
