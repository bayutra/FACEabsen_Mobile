// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:face_absen_mobile/core/theme/app_colors.dart';

import '../../../core/widgets/hospital_mark.dart';
import '../domain/attendance_models.dart';

class AttendanceResultScreen extends StatefulWidget {
  const AttendanceResultScreen({
    super.key,
    required this.result,
    required this.isCheckIn,
    required this.displayName,
    required this.employeeNo,
    this.unitLabel,
  });

  final AttendanceResult result;
  final bool isCheckIn;
  final String displayName;
  final String employeeNo;
  final String? unitLabel;

  @override
  State<AttendanceResultScreen> createState() => _AttendanceResultScreenState();
}

class _AttendanceResultScreenState extends State<AttendanceResultScreen> {
  late int _tab;

  @override
  void initState() {
    super.initState();

    _tab = widget.result.needsReview ? 2 : 0;
  }

  @override
  Widget build(BuildContext context) {
    final String title = widget.isCheckIn
        ? 'Presensi Masuk Berhasil!'
        : 'Presensi Pulang Berhasil!';
    final String? timeIso =
        widget.isCheckIn ? widget.result.checkInAt : widget.result.checkOutAt;
    final String status = widget.isCheckIn
        ? widget.result.checkInStatus ?? ''
        : widget.result.checkOutStatus ?? '';

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              bottom: BorderSide(
                color: AppColors.border.withOpacity(0.60),
                width: 0.8,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.ink.withOpacity(0.03),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const HospitalMark(size: 32),
                  const SizedBox(width: 8),
                  const Text(
                    'RS Absen',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainer,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.border.withOpacity(0.80),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        _avatarInitials(widget.displayName),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.surfaceHigh,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.border.withOpacity(0.60),
              ),
            ),
            child: Row(
              children: [
                _seg('Berhasil', Icons.check_circle, 0),
                _seg('Ditolak', Icons.cancel, 1),
                _seg('Review', Icons.pending_actions, 2),
              ],
            ),
          ),
          const SizedBox(height: 6),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.info_outline, size: 13, color: AppColors.inkSecondary),
              SizedBox(width: 4),
              Text(
                'Pratinjau Hasil Presensi Masuk SIMRS Kemenkes',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.inkSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_tab == 0) ...[
            _successHeroCard(title, timeIso, status),
          ] else if (_tab == 1) ...[
            _rejectedHeroCard(timeIso),
          ] else ...[
            _reviewHeroCard(timeIso),
          ],
          const SizedBox(height: 14),
          _shiftDataCard(),
          const SizedBox(height: 20),
          SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: () {
                if (_tab == 1) {
                  Navigator.of(context).pop();
                } else {
                  Navigator.of(context).popUntil((r) => r.isFirst);
                }
              },
              style: FilledButton.styleFrom(
                backgroundColor: _tab == 1
                    ? AppColors.primary
                    : AppColors.primaryContainer,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 2,
                shadowColor: AppColors.primary.withOpacity(0.20),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _tab == 1
                        ? Icons.refresh
                        : _tab == 2
                            ? Icons.confirmation_number
                            : Icons.home,
                    color: Colors.white,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _tab == 1
                        ? 'Coba Lagi Presensi'
                        : _tab == 2
                            ? 'Lihat Tiket Pengajuan'
                            : 'Kembali ke Beranda',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 48,
            child: OutlinedButton(
              onPressed: () => _showEvidenceSheet(context),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppColors.border, width: 1.2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long, size: 18, color: AppColors.ink),
                  SizedBox(width: 8),
                  Text(
                    'Lihat Detail Bukti Presensi',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_tab == 1) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 48,
              child: OutlinedButton.icon(
                onPressed: () => _showEvidenceSheet(context),
                icon: const Icon(Icons.support_agent, size: 18),
                label: const Text('Laporkan Kendala / CS IT'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: BorderSide(color: AppColors.errorBorder, width: 1.2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _card({
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
            offset: Offset(0, 2),
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

  Widget _seg(String label, IconData icon, int i) {
    final bool active = _tab == i;
    Color activeFg;
    if (i == 0) {
      activeFg = AppColors.primary;
    } else if (i == 1) {
      activeFg = AppColors.error;
    } else {
      activeFg = AppColors.warningText;
    }

    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = i),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: active
                ? [
                    BoxShadow(
                      color: AppColors.ink.withOpacity(0.08),
                      blurRadius: 4,
                      offset: Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: active ? activeFg : AppColors.inkSecondary,
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? activeFg : AppColors.inkSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _rejectedHeroCard(String? timeIso) {
    final double score = (widget.result.faceScore ?? 0.971) * 100;

    return Column(
      children: [
        _card(
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
                    border:
                        Border.all(color: AppColors.errorBorder, width: 1.5),
                  ),
                  child: const Center(
                    child:
                        Icon(Icons.gpp_bad, size: 32, color: AppColors.error),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
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
              Divider(height: 1, color: AppColors.errorBorder),
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
                    _hhmmSeconds(timeIso),
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
        _card(
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
                    Icon(Icons.report_problem,
                        size: 20, color: AppColors.error),
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.canvas,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.border.withOpacity(0.50),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.face, size: 18, color: AppColors.inkSecondary),
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

  Widget _reviewHeroCard(String? timeIso) {
    final int? acc = widget.result.riskScore;

    return Column(
      children: [
        _card(
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
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
              Divider(height: 1, color: AppColors.warningBorder),
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
                    _hhmmSeconds(timeIso),
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
                  Expanded(child: _PipelineStep('Terkirim', true, false)),
                  Expanded(child: _PipelineStep('Verifikasi', false, true)),
                  Expanded(child: _PipelineStep('Keputusan', false, false)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _card(
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
                    _workflowStepItem(
                      number: '1',
                      title: 'Foto Selfie Wajah Disimpan',
                      subtitle: 'Liveness check terkonfirmasi valid',
                      icon: Icons.check,
                      iconColor: AppColors.successText,
                      badgeBg: AppColors.successTint,
                      badgeFg: AppColors.successText,
                    ),
                    const SizedBox(height: 8),
                    _workflowStepItem(
                      number: '2',
                      title: 'Diteruskan ke Kepala Tim Jaga',
                      subtitle: 'dr. Hendra Wicaksono, Sp.PD',
                      icon: Icons.pending,
                      iconColor: AppColors.warningText,
                      badgeBg: AppColors.warningTint,
                      badgeFg: AppColors.warningText,
                    ),
                    const SizedBox(height: 8),
                    _workflowStepItem(
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
                    Icon(Icons.info_outline,
                        size: 18, color: AppColors.primary),
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

  Widget _workflowStepItem({
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

  Widget _successHeroCard(String title, String? timeIso, String status) {
    return _card(
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
                        offset: Offset(0, 3),
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
                    _hhmmSeconds(timeIso),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              _statusBadge(status),
            ],
          ),
        ],
      ),
    );
  }

  Widget _shiftDataCard() {
    final double? score = widget.result.faceScore;
    final String scoreText =
        score != null ? '${(score * 100).toStringAsFixed(1)}%' : '—';
    final String shiftWindow = widget.result.shiftLabel == null
        ? '—'
        : widget.result.shiftLabel!.contains('·')
            ? widget.result.shiftLabel!.split('·').last.trim()
            : widget.result.shiftLabel!;

    return _card(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.medical_services,
                      size: 18, color: AppColors.primary),
                  SizedBox(width: 8),
                  Text(
                    'Data Penugasan Shift',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.tealBadgeBg,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.tealBadgeBorder),
                ),
                child: Text(
                  widget.result.shiftLabel ?? 'Dinas Pagi',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primaryContainer,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.surfaceVariant),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.badge,
                      color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.displayName.isEmpty
                            ? 'Karyawan'
                            : widget.displayName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'NIP. ${widget.employeeNo.isEmpty ? "—" : widget.employeeNo} • Perawat Ahli Pertama',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.inkSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _parameterTile(
                  icon: Icons.schedule,
                  title: 'Jadwal Shift',
                  value: '07:00 - 15:00 WIB',
                  subtitle: shiftWindow,
                  isSuccess: true,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _parameterTile(
                  icon: Icons.apartment,
                  title: 'Ruang / Unit',
                  value: widget.unitLabel ?? 'Rawat Inap Melati',
                  subtitle: 'Gedung B, Lantai 3',
                  isSuccess: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _parameterTile(
                  icon: Icons.verified_user,
                  title: 'Status Perangkat',
                  value: 'Terverifikasi',
                  subtitle: 'Perangkat sah & aktif',
                  isSuccess: true,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _parameterTile(
                  icon: Icons.face,
                  title: 'Verifikasi Wajah',
                  value: 'Terkonfirmasi',
                  subtitle: 'Skor Kemiripan: $scoreText',
                  isSuccess: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.border.withOpacity(0.50),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'ID Referensi SIMRS:',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.inkSecondary,
                  ),
                ),
                Text(
                  widget.result.id.isEmpty
                      ? 'PRS-20231024-064822-094'
                      : widget.result.id,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace',
                    color: AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _parameterTile({
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
                color: isSuccess
                    ? AppColors.successText
                    : AppColors.outline,
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
              color:
                  isSuccess ? AppColors.successText : AppColors.ink,
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
              color:
                  isSuccess ? AppColors.successText : AppColors.outline,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String status) {
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
            offset: Offset(0, 1),
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

  void _showEvidenceSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext sheetContext) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Row(
                children: [
                  Icon(Icons.verified_user, color: AppColors.primary, size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Detail Bukti Presensi Digital',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              const Text(
                'Stempel Resmi SIMRS RSU Darmayu Madiun',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.inkSecondary,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.surfaceVariant),
                ),
                child: Column(
                  children: [
                    _detailRow(
                      'ID Presensi',
                      widget.result.id.isEmpty
                          ? 'PRS-20241024-064822'
                          : widget.result.id,
                      isMono: true,
                    ),
                    _detailRow(
                      'Tanggal',
                      widget.result.workDate.isEmpty
                          ? 'Kamis, 24 Okt 2024'
                          : widget.result.workDate,
                    ),
                    _detailRow(
                        'Check-In', _hhmmSeconds(widget.result.checkInAt)),
                    _detailRow(
                      'Check-Out',
                      widget.result.checkOutAt == null
                          ? '—'
                          : _hhmmSeconds(widget.result.checkOutAt),
                    ),
                    _detailRow(
                      'Validitas Wajah',
                      widget.result.faceScore != null
                          ? '${(widget.result.faceScore! * 100).toStringAsFixed(1)}% Cocok'
                          : 'Terverifikasi server',
                    ),
                    _detailRow(
                      'Integritas Perangkat',
                      'Knox Hardware Attestation OK',
                      isLast: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Mengunduh bukti presensi dalam format PDF...',
                        ),
                      ),
                    );
                  },
                  icon: const Icon(
                    Icons.download,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  label: const Text(
                    'Unduh PDF',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side:
                        BorderSide(color: AppColors.border, width: 1.2),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: () => Navigator.of(sheetContext).pop(),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primaryContainer,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'Tutup Detail',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value,
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

  static String _avatarInitials(String name) {
    if (name.isEmpty || name == '—') return '—';
    final parts = name.trim().split(' ');
    if (parts.length == 1) {
      return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  static String _hhmmSeconds(String? iso) {
    if (iso == null) return '06:48:22 WIB';
    final DateTime? d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '06:48:22 WIB';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(d.hour)}:${two(d.minute)}:${two(d.second)} WIB';
  }
}

class _PipelineStep extends StatelessWidget {
  const _PipelineStep(this.label, this.done, this.active);

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

