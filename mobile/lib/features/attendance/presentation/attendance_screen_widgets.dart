import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../schedule/data/schedule_repository.dart';
import '../../schedule/domain/shift_status.dart';
import '../domain/attendance_models.dart';

Widget shiftStatusCard(ScheduleEntry shift) {
  final DateTime now = DateTime.now();
  final DateTime end =
      shiftEnd(shift.workDate, shift.endTime, shift.startTime, shift.overnight);
  final bool arriving = now.isBefore(end);
  final ShiftVerdict verdict =
      arriving ? shift.checkInStatusAt(now) : shift.checkOutStatusAt(now);
  final bool warn = verdict.status == PunchStatus.late ||
      verdict.status == PunchStatus.veryLate ||
      verdict.status == PunchStatus.earlyCheckout;
  final Color fg = warn ? AppColors.warningText : AppColors.successText;
  final Color bg = warn ? AppColors.warningTint : AppColors.successTint;
  final Color border = warn ? AppColors.warningBorder : AppColors.success;
  final String base = arriving
      ? checkInStatusLabel(verdict.status)
      : checkOutStatusLabel(verdict.status);
  final String label =
      verdict.minutes > 0 ? '$base · ${verdict.minutes} mnt' : base;
  final String thresholds = arriving
      ? 'Toleransi ${shift.gracePeriodMin} mnt · Ambang telat ${shift.lateThresholdMin} mnt'
      : 'Ambang pulang cepat ${shift.earlyCheckoutThresholdMin} mnt';

  return Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: border),
    ),
    child: Row(
      children: [
        Icon(warn ? Icons.schedule : Icons.check_circle, size: 18, color: fg),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${shift.shiftName} · ${shift.window}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${arriving ? 'Status masuk' : 'Status pulang'}: $label',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: fg,
                ),
              ),
              Text(
                thresholds,
                style: const TextStyle(
                    fontSize: 10.5, color: AppColors.inkSecondary),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class AttendanceResultCard extends StatelessWidget {
  const AttendanceResultCard({super.key, required this.result});
  final AttendanceResult result;

  @override
  Widget build(BuildContext context) {
    final bool isOut = result.checkOutAt != null;
    final String status = isOut
        ? checkOutStatusLabel(result.checkOutStatus)
        : checkInStatusLabel(result.checkInStatus);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Presensi Berhasil Dicatat',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(status,
              style: const TextStyle(
                  color: AppColors.primary, fontWeight: FontWeight.w600)),
          if (result.shiftLabel != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(result.shiftLabel!,
                  style: const TextStyle(fontSize: 13, color: AppColors.ink)),
            ),
          if (result.faceScore != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                  'Kecocokan Wajah: ${(result.faceScore! * 100).round()}%',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.inkSecondary)),
            ),
        ],
      ),
    );
  }
}
