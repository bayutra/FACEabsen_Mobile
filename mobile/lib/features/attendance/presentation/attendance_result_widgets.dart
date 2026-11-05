import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

String hhmmSeconds(String? iso) {
  if (iso == null) return '06:48:22 WIB';
  final DateTime? d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '06:48:22 WIB';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.hour)}:${two(d.minute)}:${two(d.second)} WIB';
}

Widget resultCard({
  required Widget child,
  Color? accentColor,
  Color? borderColor,
  EdgeInsetsGeometry padding = const EdgeInsets.all(16),
}) {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(
        color: borderColor ?? AppColors.border.withOpacity(0.50),
      ),
      boxShadow: [
        BoxShadow(
          color: AppColors.ink.withOpacity(0.04),
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ],
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (accentColor != null)
            Container(
              height: 4,
              color: accentColor,
            ),
          Padding(
            padding: padding,
            child: child,
          ),
        ],
      ),
    ),
  );
}

Widget workflowStepItem({
  required String number,
  required String title,
  required String subtitle,
  required IconData icon,
  required Color iconColor,
  required Color badgeBg,
  required Color badgeFg,
  bool isMuted = false,
}) {
  return Opacity(
    opacity: isMuted ? 0.6 : 1.0,
    child: Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: badgeBg,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              number,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: badgeFg,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.inkSecondary,
                ),
              ),
            ],
          ),
        ),
        Icon(icon, size: 18, color: iconColor),
      ],
    ),
  );
}

Widget parameterTile({
  required IconData icon,
  required String title,
  required String value,
  required String subtitle,
  required bool isSuccess,
}) {
  return Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: AppColors.canvas,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(
        color: AppColors.border.withOpacity(0.50),
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              icon,
              size: 14,
              color: isSuccess ? AppColors.successText : AppColors.outline,
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.outline,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            color: isSuccess ? AppColors.successText : AppColors.ink,
            fontWeight: FontWeight.w700,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 1),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 10,
            color: isSuccess ? AppColors.successText : AppColors.outline,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    ),
  );
}

Widget statusBadge(String status) {
  late Color bg;
  late Color fg;
  late Color border;
  late String label;
  late IconData icon;
  switch (status) {
    case 'ON_TIME':
    case 'NORMAL_CHECKOUT':
      bg = AppColors.successTint;
      fg = AppColors.successText;
      border = AppColors.successBorder;
      label = 'Tepat Waktu';
      icon = Icons.check_circle;
      break;
    case 'LATE':
    case 'VERY_LATE':
    case 'EARLY_CHECKOUT':
      bg = AppColors.warningTint;
      fg = AppColors.warningText;
      border = AppColors.warningBorder;
      label = status == 'EARLY_CHECKOUT' ? 'Pulang Cepat' : 'Terlambat';
      icon = Icons.schedule;
      break;
    default:
      bg = AppColors.successTint;
      fg = AppColors.successText;
      border = AppColors.successBorder;
      label = 'Tepat Waktu';
      icon = Icons.check_circle;
  }

  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: border),
      boxShadow: [
        BoxShadow(
          color: AppColors.ink.withOpacity(0.02),
          blurRadius: 4,
          offset: const Offset(0, 1),
        ),
      ],
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: fg),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: fg,
          ),
        ),
      ],
    ),
  );
}

Widget detailRow(String label, String value,
    {bool isMono = false, bool isLast = false}) {
  return Padding(
    padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.inkSecondary,
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              fontFamily: isMono ? 'monospace' : null,
              color: AppColors.ink,
            ),
          ),
        ),
      ],
    ),
  );
}

class PipelineStep extends StatelessWidget {
  const PipelineStep({
    super.key,
    required this.label,
    required this.done,
    required this.active,
  });

  final String label;
  final bool done;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final Color dot = done
        ? AppColors.success
        : active
            ? AppColors.secondary
            : AppColors.outline;
    final Color bg = done
        ? AppColors.successTint
        : active
            ? AppColors.surfaceLow
            : AppColors.surfaceLow;
    return Column(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            border: Border.all(color: dot, width: 2),
          ),
          child: done
              ? const Icon(
                  Icons.check,
                  size: 14,
                  color: AppColors.successText,
                )
              : null,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: AppColors.inkSecondary,
          ),
        ),
      ],
    );
  }
}
