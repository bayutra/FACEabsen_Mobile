import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../domain/attendance_models.dart';
import 'history_format.dart';

/// The attendance card shown in the personal history list.
class HistoryAttendanceCard extends StatelessWidget {
  const HistoryAttendanceCard({
    super.key,
    required this.item,
    required this.onOpen,
  });

  final AttendanceHistoryItem item;
  final ValueChanged<AttendanceHistoryItem> onOpen;

  @override
  Widget build(BuildContext context) {
    final bool hasCheckIn = item.checkInAt != null;
    final bool isOnTime = item.checkInStatus == 'ON_TIME';
    final bool isLate = item.checkInStatus == 'LATE';
    final bool isVeryLate = item.checkInStatus == 'VERY_LATE';

    final Color stripeColor;
    if (!hasCheckIn) {
      stripeColor = AppColors.border;
    } else if (isOnTime) {
      stripeColor = AppColors.success;
    } else if (isLate) {
      stripeColor = AppColors.warning;
    } else if (isVeryLate) {
      stripeColor = AppColors.error;
    } else {
      stripeColor = AppColors.secondary;
    }

    final String? duration =
        effectiveDurationLabel(item.checkInAt, item.checkOutAt);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border(
          left: BorderSide(color: stripeColor, width: 4),
          top: BorderSide(color: AppColors.border.withOpacity(0.5)),
          right: BorderSide(color: AppColors.border.withOpacity(0.5)),
          bottom: BorderSide(color: AppColors.border.withOpacity(0.5)),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => onOpen(item),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.shiftName ?? 'Shift Dinas',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(
                                Icons.schedule,
                                size: 13,
                                color: AppColors.outline,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                item.shiftWindow ?? 'Jam Dinas Operasional',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.inkSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    _buildStatusPill(item),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.canvas,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.border.withOpacity(0.35),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Masuk (In)',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.inkSecondary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.checkInAt == null
                                  ? '--:--'
                                  : '${clockHm(item.checkInAt)} WIB',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.checkInAt == null
                                  ? 'Belum presensi'
                                  : checkInStatusLabel(item.checkInStatus),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                                color: item.checkInAt == null
                                    ? AppColors.outline
                                    : (isOnTime
                                        ? AppColors.successText
                                        : AppColors.warningText),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 38,
                        color: AppColors.border.withOpacity(0.4),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Pulang (Out)',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.inkSecondary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.checkOutAt != null
                                  ? '${clockHm(item.checkOutAt)} WIB'
                                  : (item.checkInAt != null
                                      ? 'Sedang Dinas'
                                      : '--:--'),
                              style: TextStyle(
                                fontSize: item.checkOutAt != null ||
                                        item.checkInAt == null
                                    ? 15
                                    : 13,
                                fontWeight: FontWeight.w700,
                                color: item.checkOutAt != null
                                    ? AppColors.ink
                                    : (item.checkInAt != null
                                        ? AppColors.secondary
                                        : AppColors.outline),
                                fontFeatures: const [
                                  FontFeature.tabularFigures()
                                ],
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.checkOutAt != null
                                  ? checkOutStatusLabel(item.checkOutStatus)
                                  : (item.shiftWindow != null
                                      ? 'Batas ${item.shiftWindow!.split('→').last.trim()}'
                                      : 'Menunggu selesai'),
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.outline,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (duration != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(
                        Icons.timelapse,
                        size: 13,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        'Durasi Kerja: ',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.inkSecondary,
                        ),
                      ),
                      Text(
                        duration,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withOpacity(0.12),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primaryContainer.withOpacity(0.3),
                        ),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.near_me,
                          size: 12,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Expanded(
                      child: Text(
                        'Terverifikasi Sistem',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.inkSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Lihat Detail',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                        Icon(
                          Icons.chevron_right,
                          size: 16,
                          color: AppColors.primary,
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusPill(AttendanceHistoryItem item) {
    final Color bg;
    final Color fg;
    final Color border;
    final Color dotColor;
    final String label;

    if (item.checkInAt == null) {
      bg = AppColors.surfaceLow;
      fg = AppColors.outline;
      border = AppColors.border;
      dotColor = AppColors.outline;
      label = 'Tidak Absen';
    } else if (item.checkInStatus == 'ON_TIME') {
      bg = AppColors.successTint;
      fg = AppColors.successText;
      border = AppColors.successBorder;
      dotColor = AppColors.successText;
      label = 'Tepat Waktu';
    } else if (item.checkInStatus == 'VERY_LATE') {
      bg = AppColors.roseTint;
      fg = AppColors.roseText;
      border = AppColors.errorBorder;
      dotColor = AppColors.roseText;
      label = 'Sgt Terlambat';
    } else {
      bg = AppColors.warningTint;
      fg = AppColors.warningText;
      border = AppColors.warningBorder;
      dotColor = AppColors.warningText;
      label = checkInStatusLabel(item.checkInStatus);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}
