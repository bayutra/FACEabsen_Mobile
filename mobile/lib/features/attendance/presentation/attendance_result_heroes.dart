import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../domain/attendance_models.dart';
import 'attendance_result_widgets.dart';

Widget rejectedHeroCard({
  required AttendanceResult result,
  required String? timeIso,
}) {
  final double score = (result.faceScore ?? 0.971) * 100;

  return Column(
    children: [
      resultCard(
        accentColor: AppColors.error,
        borderColor: AppColors.errorBorder,
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Center(
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.roseTint,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.errorBorder, width: 1.5),
                ),
                child: const Center(
                  child: Icon(Icons.gpp_bad, size: 32, color: AppColors.error),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.roseTint,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.errorBorder),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline,
                      size: 14, color: AppColors.roseText),
                  SizedBox(width: 4),
                  Text(
                    'Presensi Ditolak',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.roseText,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Presensi Gagal Diproses',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Verifikasi presensi tidak lolos. Silakan ulangi proses presensi.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.inkSecondary,
              ),
            ),
            const SizedBox(height: 14),
            const Divider(height: 1, color: AppColors.errorBorder),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'WAKTU PERCOBAAN',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                    color: AppColors.outline,
                  ),
                ),
                Text(
                  hhmmSeconds(timeIso),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.error,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      resultCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.report_problem,
                        size: 18, color: AppColors.error),
                    SizedBox(width: 6),
                    Text(
                      'Diagnosa Sistem Absensi',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.roseTint,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.errorBorder),
                  ),
                  child: const Text(
                    'ERR-ATT-01',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.error,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.roseTint,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.errorBorder),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.report_problem, size: 20, color: AppColors.error),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Presensi Tidak Dapat Diproses',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.roseTextDark,
                          ),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Sistem tidak dapat memverifikasi presensi Anda. Pastikan wajah terlihat jelas dan perangkat dalam kondisi sah, lalu coba lagi.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.roseText,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.canvas,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.border.withOpacity(0.50),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.face,
                      size: 18, color: AppColors.inkSecondary),
                  const SizedBox(width: 8),
                  const Text(
                    'Pencocokan Biometrik Wajah',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.ink,
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.check_circle,
                      size: 15, color: AppColors.successText),
                  const SizedBox(width: 4),
                  Text(
                    'Sesuai (${score.toStringAsFixed(1)}%)',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.successText,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceVariant),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.policy, size: 16, color: AppColors.primary),
                      SizedBox(width: 6),
                      Text(
                        'Aturan Kepatuhan Presensi RS:',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 6),
                  Text(
                    '1. Presensi wajib dilakukan menggunakan akun dan perangkat Anda sendiri.\n2. Pastikan wajah terlihat jelas dan pencahayaan cukup saat pengambilan biometrik.',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.inkSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

Widget reviewHeroCard({
  required AttendanceResult result,
  required String? timeIso,
}) {
  final int? acc = result.riskScore;

  return Column(
    children: [
      resultCard(
        accentColor: AppColors.warning,
        borderColor: AppColors.warningBorder,
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Center(
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.warningTint,
                  shape: BoxShape.circle,
                  border:
                      Border.all(color: AppColors.warningBorder, width: 1.5),
                ),
                child: const Center(
                  child: Icon(Icons.hourglass_top,
                      size: 32, color: AppColors.warningText),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.warningTint,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.warningBorder),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.schedule, size: 14, color: AppColors.warningText),
                  SizedBox(width: 4),
                  Text(
                    'Menunggu Review',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.warningText,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Presensi Menunggu Validasi',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Pengajuan otomatis diteruskan untuk verifikasi manual atasan',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.inkSecondary,
              ),
            ),
            const SizedBox(height: 14),
            const Divider(height: 1, color: AppColors.warningBorder),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'DICATAT PADA',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                    color: AppColors.outline,
                  ),
                ),
                Text(
                  hhmmSeconds(timeIso),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.warningText,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Row(
              children: [
                Expanded(
                    child: PipelineStep(
                        label: 'Terkirim', done: true, active: false)),
                Expanded(
                    child: PipelineStep(
                        label: 'Verifikasi', done: false, active: true)),
                Expanded(
                    child: PipelineStep(
                        label: 'Keputusan', done: false, active: false)),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      resultCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.assignment_late,
                        size: 18, color: AppColors.warningText),
                    SizedBox(width: 6),
                    Text(
                      'Alasan Dispensasi Presensi',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: AppColors.border.withOpacity(0.50),
                    ),
                  ),
                  child: Text(
                    acc != null ? 'Skor Risiko $acc' : 'DISP-2981',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warningTint,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.warningBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.attribution,
                      size: 20, color: AppColors.warningText),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Verifikasi Wajah Perlu Tinjauan Manual',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.warningText,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Skor risiko presensi di bawah ambang otomatis sehingga diteruskan ke verifikasi kepegawaian${acc != null ? ' (Skor: $acc)' : ''}.',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.warningText,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
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
                  const Text(
                    'ALUR VERIFIKASI MANUAL KEPEGAWAIAN',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                      color: AppColors.outline,
                    ),
                  ),
                  const SizedBox(height: 10),
                  workflowStepItem(
                    number: '1',
                    title: 'Foto Selfie Wajah Disimpan',
                    subtitle: 'Liveness check terkonfirmasi valid',
                    icon: Icons.check,
                    iconColor: AppColors.successText,
                    badgeBg: AppColors.successTint,
                    badgeFg: AppColors.successText,
                  ),
                  const SizedBox(height: 8),
                  workflowStepItem(
                    number: '2',
                    title: 'Diteruskan ke Kepala Tim Jaga',
                    subtitle: 'dr. Hendra Wicaksono, Sp.PD',
                    icon: Icons.pending,
                    iconColor: AppColors.warningText,
                    badgeBg: AppColors.warningTint,
                    badgeFg: AppColors.warningText,
                  ),
                  const SizedBox(height: 8),
                  workflowStepItem(
                    number: '3',
                    title: 'Validasi SDM Kepegawaian',
                    subtitle: 'Pencatatan resmi ke payroll rumah sakit',
                    icon: Icons.schedule,
                    iconColor: AppColors.outline,
                    badgeBg: AppColors.surfaceContainer,
                    badgeFg: AppColors.ink,
                    isMuted: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceVariant),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 18, color: AppColors.primary),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Hasil verifikasi biometrik presensi otomatis diteruskan ke Kepala Tim & SDM Kepegawaian untuk validasi manual dalam kurun waktu 1x24 jam.',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.inkSecondary,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

Widget successHeroCard({
  required String title,
  required String? timeIso,
  required String status,
}) {
  return resultCard(
    accentColor: AppColors.primary,
    padding: const EdgeInsets.all(20),
    child: Column(
      children: [
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primaryFixed.withOpacity(0.45),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.12),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.verified,
                  size: 30,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: AppColors.ink,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Stempel waktu kehadiran tervalidasi server Rumah Sakit',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            color: AppColors.inkSecondary,
          ),
        ),
        const SizedBox(height: 16),
        const Divider(height: 1, color: AppColors.surfaceContainer),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'WAKTU PRESENSI',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                    color: AppColors.outline,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hhmmSeconds(timeIso),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            statusBadge(status),
          ],
        ),
      ],
    ),
  );
}
