// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:face_absen_mobile/core/theme/app_colors.dart';

import '../../../core/widgets/hospital_mark.dart';
import '../domain/attendance_models.dart';
import 'attendance_result_heroes.dart';
import 'attendance_result_widgets.dart';

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
            successHeroCard(title: title, timeIso: timeIso, status: status),
          ] else if (_tab == 1) ...[
            rejectedHeroCard(result: widget.result, timeIso: timeIso),
          ] else ...[
            reviewHeroCard(result: widget.result, timeIso: timeIso),
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
                backgroundColor:
                    _tab == 1 ? AppColors.primary : AppColors.primaryContainer,
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

  Widget _shiftDataCard() {
    final double? score = widget.result.faceScore;
    final String scoreText =
        score != null ? '${(score * 100).toStringAsFixed(1)}%' : '—';
    final String shiftWindow = widget.result.shiftLabel == null
        ? '—'
        : widget.result.shiftLabel!.contains('·')
            ? widget.result.shiftLabel!.split('·').last.trim()
            : widget.result.shiftLabel!;

    return resultCard(
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
                child: parameterTile(
                  icon: Icons.schedule,
                  title: 'Jadwal Shift',
                  value: '07:00 - 15:00 WIB',
                  subtitle: shiftWindow,
                  isSuccess: true,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: parameterTile(
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
                child: parameterTile(
                  icon: Icons.verified_user,
                  title: 'Status Perangkat',
                  value: 'Terverifikasi',
                  subtitle: 'Perangkat sah & aktif',
                  isSuccess: true,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: parameterTile(
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
                    detailRow(
                      'ID Presensi',
                      widget.result.id.isEmpty
                          ? 'PRS-20241024-064822'
                          : widget.result.id,
                      isMono: true,
                    ),
                    detailRow(
                      'Tanggal',
                      widget.result.workDate.isEmpty
                          ? 'Kamis, 24 Okt 2024'
                          : widget.result.workDate,
                    ),
                    detailRow('Check-In', hhmmSeconds(widget.result.checkInAt)),
                    detailRow(
                      'Check-Out',
                      widget.result.checkOutAt == null
                          ? '—'
                          : hhmmSeconds(widget.result.checkOutAt),
                    ),
                    detailRow(
                      'Validitas Wajah',
                      widget.result.faceScore != null
                          ? '${(widget.result.faceScore! * 100).toStringAsFixed(1)}% Cocok'
                          : 'Terverifikasi server',
                    ),
                    detailRow(
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
                    side: BorderSide(color: AppColors.border, width: 1.2),
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

  static String _avatarInitials(String name) {
    if (name.isEmpty || name == '—') return '—';
    final parts = name.trim().split(' ');
    if (parts.length == 1) {
      return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }
}
