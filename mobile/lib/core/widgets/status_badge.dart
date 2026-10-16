import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'stitch.dart';
import '../../features/device/domain/device_models.dart';

/// Stitch status pill (28px height, full radius, label-md).
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final DeviceStatus status;

  _Spec get _spec {
    switch (status) {
      case DeviceStatus.active:
        return const _Spec(AppColors.successTint, AppColors.successText, AppColors.successBorder);
      case DeviceStatus.pending:
        return const _Spec(AppColors.warningTint, AppColors.warningText, AppColors.warningBorder);
      case DeviceStatus.revoked:
      case DeviceStatus.lost:
      case DeviceStatus.replaced:
        return const _Spec(AppColors.roseTint, AppColors.roseText, AppColors.roseBorder);
      case DeviceStatus.unknown:
        return const _Spec(AppColors.surfaceLow, AppColors.inkSecondary, AppColors.border);
    }
  }

  @override
  Widget build(BuildContext context) {
    final _Spec s = _spec;
    return AppPill(deviceStatusLabel(status), s.bg, s.fg, border: s.border);
  }
}

class _Spec {
  const _Spec(this.bg, this.fg, this.border);
  final Color bg;
  final Color fg;
  final Color border;
}
