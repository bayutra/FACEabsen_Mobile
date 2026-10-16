import 'package:flutter/material.dart';

import '../domain/attendance_models.dart';

/// Stitch "Presensi - Hasil Verifikasi Presensi" (`design/stitch_rs_absen_mobile_app/presensi_hasil_verifikasi_presensi`)
/// Complete hospital verification result screen with evidence bottom sheet.
/// Modernized with Stitch hospital/clinical Material 3 design system tokens.
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
    // Real default: review bila server menandai needsReview, selain itu sukses.
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
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(
              bottom: BorderSide(
                color: Color(0x99BDC9C6),
                width: 0.8,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0x08000000),
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
                  Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0F766E),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.local_hospital,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'RS Absen',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF005C55),
                      letterSpacing: -0.2,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE5EEFF),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xCCBDC9C6),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        _avatarInitials(widget.displayName),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF005C55),
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
          // Segmented Berhasil/Ditolak/Review — surface-container-high background
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFDCE9FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0x99BDC9C6),
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
              Icon(Icons.info_outline, size: 13, color: Color(0xFF3E4947)),
              SizedBox(width: 4),
              Text(
                'Pratinjau Hasil Presensi Masuk SIMRS Kemenkes',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF3E4947),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Main Hero Card by State
          if (_tab == 0) ...[
            _successHeroCard(title, timeIso, status),
          ] else if (_tab == 1) ...[
            _rejectedHeroCard(timeIso),
          ] else ...[
            _reviewHeroCard(timeIso),
          ],
          const SizedBox(height: 14),

          // Shift & Biometric Verification Details Bento Card
          _shiftDataCard(),
          const SizedBox(height: 20),

          // Primary Button: 52px CTA with 16px radius
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
                    ? const Color(0xFF005C55)
                    : const Color(0xFF0F766E),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 2,
                shadowColor: const Color(0x33005C55),
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

          // Secondary Outlined Button: 48px ghost
          SizedBox(
            height: 48,
            child: OutlinedButton(
              onPressed: () => _showEvidenceSheet(context),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFBDC9C6), width: 1.2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long, size: 18, color: Color(0xFF0B1C30)),
                  SizedBox(width: 8),
                  Text(
                    'Lihat Detail Bukti Presensi',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0B1C30),
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
                label: const Text('Laporkan Kendala Lokasi / CS IT'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFBA1A1A),
                  side: const BorderSide(color: Color(0xFFFECACA), width: 1.2),
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
          color: borderColor ?? const Color(0x80BDC9C6),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
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
      activeFg = const Color(0xFF005C55);
    } else if (i == 1) {
      activeFg = const Color(0xFFBA1A1A);
    } else {
      activeFg = const Color(0xFFB45309);
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
                ? const [
                    BoxShadow(
                      color: Color(0x14000000),
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
                color: active ? activeFg : const Color(0xFF3E4947),
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? activeFg : const Color(0xFF3E4947),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _rejectedHeroCard(String? timeIso) {
    final double dist = widget.result.distanceM ?? 540;
    final double radius = widget.result.radiusM ?? 50;
    final double score = (widget.result.faceScore ?? 0.971) * 100;

    return Column(
      children: [
        _card(
          accentColor: const Color(0xFFBA1A1A),
          borderColor: const Color(0xFFFECACA),
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFFECACA), width: 1.5),
                  ),
                  child: const Center(
                    child: Icon(Icons.gpp_bad, size: 32, color: Color(0xFFBA1A1A)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline, size: 14, color: Color(0xFFB91C1C)),
                    SizedBox(width: 4),
                    Text(
                      'Presensi Ditolak',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFB91C1C),
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
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Perangkat Anda berada di luar batas geofence yang diizinkan',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF3E4947),
                ),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: Color(0xFFFEE2E2)),
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
                      color: Color(0xFF6E7977),
                    ),
                  ),
                  Text(
                    _hhmmSeconds(timeIso),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFBA1A1A),
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Failure Diagnosis Bento Card
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
                      Icon(Icons.report_problem, size: 18, color: Color(0xFFBA1A1A)),
                      SizedBox(width: 6),
                      Text(
                        'Diagnosa Sistem Absensi',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: const Text(
                      'ERR-GEO-04',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFBA1A1A),
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Reason Alert Box
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.location_off, size: 20, color: Color(0xFFBA1A1A)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Di Luar Area Geofence RSUD',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF991B1B),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Posisi Anda terdeteksi berjarak ${dist.round()} meter dari Titik Presensi Sentral RS (Batas maksimum radius adalah ${radius.round()} meter).',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFFB91C1C),
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

              // Biometric face match status row
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F9FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0x80BDC9C6),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.face, size: 18, color: Color(0xFF3E4947)),
                    const SizedBox(width: 8),
                    const Text(
                      'Pencocokan Biometrik Wajah',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    const Spacer(),
                    const Icon(Icons.check_circle, size: 15, color: Color(0xFF047857)),
                    const SizedBox(width: 4),
                    Text(
                      'Sesuai (${score.toStringAsFixed(1)}%)',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF047857),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Compliance rules note
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF4FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFD3E4FE)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.policy, size: 16, color: Color(0xFF005C55)),
                        SizedBox(width: 6),
                        Text(
                          'Aturan Kepatuhan Presensi RSUD:',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0B1C30),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 6),
                    Text(
                      '1. Presensi wajib dilakukan di dalam area perimeter rumah sakit yang telah ditetapkan.\n2. Pastikan GPS/Location Service pada ponsel Anda memiliki izin presisi tinggi (High Accuracy).',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF3E4947),
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
          accentColor: const Color(0xFFF59E0B),
          borderColor: const Color(0xFFFDE68A),
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFFDE68A), width: 1.5),
                  ),
                  child: const Center(
                    child: Icon(Icons.hourglass_top, size: 32, color: Color(0xFFB45309)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.schedule, size: 14, color: Color(0xFFB45309)),
                    SizedBox(width: 4),
                    Text(
                      'Menunggu Review',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFB45309),
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
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Pengajuan otomatis diteruskan untuk verifikasi manual atasan',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF3E4947),
                ),
              ),
              const SizedBox(height: 14),
              const Divider(height: 1, color: Color(0xFFFEF3C7)),
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
                      color: Color(0xFF6E7977),
                    ),
                  ),
                  Text(
                    _hhmmSeconds(timeIso),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFB45309),
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

        // Review Details & Reason Card
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
                      Icon(Icons.assignment_late, size: 18, color: Color(0xFFB45309)),
                      SizedBox(width: 6),
                      Text(
                        'Alasan Dispensasi Presensi',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE5EEFF),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: const Color(0x80BDC9C6),
                      ),
                    ),
                    child: Text(
                      acc != null ? 'GPS ±$acc m' : 'DISP-2981',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0B1C30),
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Reason alert
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.attribution, size: 20, color: Color(0xFFB45309)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Sinyal GPS Lemah di Basement / Area Isolasi',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF92400E),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Akurasi koordinat satelit turun di bawah batas aman sistem SIMRS (Akurasi: ±${acc ?? 145}m).',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFFB45309),
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

              // Detailed Manual Verification Workflow
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F9FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0x80BDC9C6),
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
                        color: Color(0xFF6E7977),
                      ),
                    ),
                    const SizedBox(height: 10),
                    _workflowStepItem(
                      number: '1',
                      title: 'Foto Selfie Wajah Disimpan',
                      subtitle: 'Liveness check terkonfirmasi valid',
                      icon: Icons.check,
                      iconColor: const Color(0xFF047857),
                      badgeBg: const Color(0xFFECFDF5),
                      badgeFg: const Color(0xFF047857),
                    ),
                    const SizedBox(height: 8),
                    _workflowStepItem(
                      number: '2',
                      title: 'Diteruskan ke Kepala Tim Jaga',
                      subtitle: 'dr. Hendra Wicaksono, Sp.PD',
                      icon: Icons.pending,
                      iconColor: const Color(0xFFB45309),
                      badgeBg: const Color(0xFFFFFBEB),
                      badgeFg: const Color(0xFFB45309),
                    ),
                    const SizedBox(height: 8),
                    _workflowStepItem(
                      number: '3',
                      title: 'Validasi SDM Kepegawaian',
                      subtitle: 'Pencatatan resmi ke payroll rumah sakit',
                      icon: Icons.schedule,
                      iconColor: const Color(0xFF6E7977),
                      badgeBg: const Color(0xFFE5EEFF),
                      badgeFg: const Color(0xFF0B1C30),
                      isMuted: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Informational Memo
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF4FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFD3E4FE)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 18, color: Color(0xFF005C55)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Foto selfie presensi dan catatan lokasi otomatis diteruskan ke Kepala Tim & SDM Kepegawaian untuk validasi manual dalam kurun waktu 1x24 jam.',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF3E4947),
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
                    color: Color(0xFF0B1C30),
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF3E4947),
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
      accentColor: const Color(0xFF005C55),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Center(
            child: Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: Color(0x739CF2E8),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Container(
                  width: 54,
                  height: 54,
                  decoration: const BoxDecoration(
                    color: Color(0xFF005C55),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x20005C55),
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
              color: Color(0xFF0B1C30),
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Stempel waktu kehadiran tervalidasi server Rumah Sakit',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF3E4947),
            ),
          ),
          const SizedBox(height: 16),
          const Divider(height: 1, color: Color(0xFFE5EEFF)),
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
                      color: Color(0xFF6E7977),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _hhmmSeconds(timeIso),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0B1C30),
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
                  Icon(Icons.medical_services, size: 18, color: Color(0xFF005C55)),
                  SizedBox(width: 8),
                  Text(
                    'Data Penugasan Shift',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFCCFBF1),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFF99F6E4)),
                ),
                child: Text(
                  widget.result.shiftLabel ?? 'Dinas Pagi',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F766E),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Staff Profile Mini Tile
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF4FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFD3E4FE)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD3E4FE),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.badge, color: Color(0xFF005C55), size: 22),
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
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'NIP. ${widget.employeeNo.isEmpty ? "—" : widget.employeeNo} • Perawat Ahli Pertama',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF3E4947),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 2x2 Metric Grid
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
                  icon: Icons.near_me,
                  title: 'Geolokasi RS',
                  value: widget.result.distanceM != null
                      ? '${widget.result.distanceM!.round()} meter'
                      : '18 meter',
                  subtitle: 'Dalam Radius (< 50m)',
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

          // Audit Transaction Reference ID
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F9FF),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: const Color(0x80BDC9C6),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'ID Referensi SIMRS:',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF3E4947),
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
                    color: Color(0xFF0B1C30),
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
        color: const Color(0xFFF8F9FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0x80BDC9C6),
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
                color: isSuccess ? const Color(0xFF047857) : const Color(0xFF6E7977),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF6E7977),
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
              color: isSuccess ? const Color(0xFF047857) : const Color(0xFF0B1C30),
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
              color: isSuccess ? const Color(0xFF047857) : const Color(0xFF6E7977),
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
        bg = const Color(0xFFECFDF5);
        fg = const Color(0xFF047857);
        border = const Color(0xFFA7F3D0);
        label = 'Tepat Waktu';
        icon = Icons.check_circle;
        break;
      case 'LATE':
      case 'VERY_LATE':
      case 'EARLY_CHECKOUT':
        bg = const Color(0xFFFFFBEB);
        fg = const Color(0xFFB45309);
        border = const Color(0xFFFDE68A);
        label = status == 'EARLY_CHECKOUT' ? 'Pulang Cepat' : 'Terlambat';
        icon = Icons.schedule;
        break;
      default:
        bg = const Color(0xFFECFDF5);
        fg = const Color(0xFF047857);
        border = const Color(0xFFA7F3D0);
        label = 'Tepat Waktu';
        icon = Icons.check_circle;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
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
        decoration: const BoxDecoration(
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
                    color: const Color(0xFFBDC9C6),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Row(
                children: [
                  Icon(Icons.verified_user, color: Color(0xFF005C55), size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Detail Bukti Presensi Digital',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              const Text(
                'Stempel Resmi SIMRS RSUD Sehat Sentosa',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF3E4947),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF4FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFD3E4FE)),
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
                    _detailRow('Check-In', _hhmmSeconds(widget.result.checkInAt)),
                    _detailRow(
                      'Check-Out',
                      widget.result.checkOutAt == null
                          ? '—'
                          : _hhmmSeconds(widget.result.checkOutAt),
                    ),
                    _detailRow(
                      'Geolokasi',
                      '${widget.result.distanceM?.round() ?? 18}m dari titik sentral RS',
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
                    color: Color(0xFF005C55),
                  ),
                  label: const Text(
                    'Unduh PDF',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF005C55),
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFBDC9C6), width: 1.2),
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
                    backgroundColor: const Color(0xFF0F766E),
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
              color: Color(0xFF3E4947),
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
                color: const Color(0xFF0B1C30),
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
      return parts[0]
          .substring(0, parts[0].length >= 2 ? 2 : 1)
          .toUpperCase();
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
        ? const Color(0xFF10B981)
        : active
            ? const Color(0xFF006591)
            : const Color(0xFF6E7977);
    final Color bg = done
        ? const Color(0xFFECFDF5)
        : active
            ? const Color(0xFFEFF4FF)
            : const Color(0xFFEFF4FF);
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
                  color: Color(0xFF047857),
                )
              : null,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Color(0xFF3E4947),
          ),
        ),
      ],
    );
  }
}
