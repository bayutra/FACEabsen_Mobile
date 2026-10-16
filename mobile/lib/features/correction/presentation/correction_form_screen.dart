import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../data/correction_repository.dart';
import '../domain/correction_models.dart';
import '../../../core/theme/app_colors.dart';

/// Stitch "Pengajuan Koreksi Presensi":
/// 3x24h policy banner, employee shift context, quota indicator (2/3),
/// 4-card radio bento grid (Lupa Check-in, Lupa Check-out, Kesalahan Waktu, Masalah Teknis),
/// time inputs, and 52px submission CTA.
class CorrectionFormScreen extends StatefulWidget {
  const CorrectionFormScreen({
    super.key,
    required this.corrections,
    required this.attendanceId,
    required this.workDate,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
  });

  final CorrectionRepository corrections;
  final String attendanceId;
  final String workDate;
  final String displayName;
  final String employeeNo;

  @override
  State<CorrectionFormScreen> createState() => _CorrectionFormScreenState();
}

/// Manual id-ID date: `Kamis, 24 Okt 2024`. Falls back to [ymd].
String _formatWorkDate(String ymd) {
  final DateTime? d = DateTime.tryParse(ymd);
  if (d == null) return ymd;
  const List<String> hari = [
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
  ];
  const List<String> bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return '${hari[d.weekday - 1]}, ${d.day} ${bulan[d.month - 1]} ${d.year}';
}

class _CorrectionFormScreenState extends State<CorrectionFormScreen> {
  String _type = 'MISSED_CHECK_IN';
  final _inTime = TextEditingController();
  final _outTime = TextEditingController();
  final _reason = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _inTime.dispose();
    _outTime.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final String? reqIn = combineWorkDateTime(widget.workDate, _inTime.text);
    final String? reqOut = combineWorkDateTime(widget.workDate, _outTime.text);
    if ((reqIn == null && _inTime.text.trim().isNotEmpty) ||
        (reqOut == null && _outTime.text.trim().isNotEmpty)) {
      setState(() => _error = 'Format jam salah. Gunakan HH:mm, contoh 07:05.');
      return;
    }
    if (reqIn == null && reqOut == null) {
      setState(() => _error = 'Isi jam masuk dan/atau jam pulang yang dikoreksi.');
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = 'Alasan permohonan koreksi wajib diisi.');
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      await widget.corrections.create(
        attendanceId: widget.attendanceId,
        type: _type,
        requestedCheckIn: reqIn,
        requestedCheckOut: reqOut,
        reason: _reason.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.response?.statusCode == 409
            ? 'Sudah ada pengajuan aktif untuk presensi tanggal ini.'
            : 'Pengajuan gagal (${e.response?.statusCode ?? 'tanpa kode'}).';
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Pengajuan gagal. Periksa koneksi ke server SIMRS.';
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pengajuan Koreksi', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            Text('Formulir Perbaikan Data Absensi SIMRS',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400)),
          ],
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Policy Notice Banner (3x24h SLA)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: AppColors.secondary, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Kebijakan Batas Waktu SIMRS',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF004C6E),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Koreksi hanya dapat diajukan maksimal 3x24 jam setelah jadwal shift berakhir. Pengajuan memerlukan persetujuan Kepala Ruangan & Kepegawaian.',
                          style: TextStyle(fontSize: 11.5, color: AppColors.inkSecondary, height: 1.35),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // Employee & Shift Context Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.5)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.assignment_outlined, color: AppColors.primary, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    widget.displayName,
                                    style: const TextStyle(
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.ink,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text('NIP: ${widget.employeeNo}', style: const TextStyle(fontSize: 11, color: AppColors.outline)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(height: 1),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Sisa Kuota Koreksi Bulan Ini:',
                        style: TextStyle(fontSize: 11.5, color: AppColors.outline),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLow,
                          borderRadius: BorderRadius.circular(AppColors.radiusFull),
                        ),
                        child: const Text(
                          'Mengikuti ketentuan SIMRS',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 1. Shift Date Context Tile
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.calendar_month, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Tanggal Presensi: ${_formatWorkDate(widget.workDate)}',
                          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.ink),
                        ),
                        const SizedBox(height: 2),
                        const Row(
                          children: [
                            CircleAvatar(radius: 3, backgroundColor: AppColors.primary),
                            SizedBox(width: 5),
                            Expanded(
                              child: Text(
                                'Jadwal shift mengikuti roster dinas aktif',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.primary),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 2. Radio Bento Grid (4 Correction Types)
            const Text(
              'JENIS KOREKSI PRESENSI',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: AppColors.inkSecondary),
            ),
            const SizedBox(height: 8),

            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
                _typeCard(
                  type: 'MISSED_CHECK_IN',
                  title: 'Lupa Check-in',
                  subtitle: 'Masuk shift',
                  icon: Icons.login,
                ),
                _typeCard(
                  type: 'MISSED_CHECK_OUT',
                  title: 'Lupa Check-out',
                  subtitle: 'Pulang shift',
                  icon: Icons.logout,
                ),
                _typeCard(
                  type: 'WRONG_TIME',
                  title: 'Kesalahan Waktu',
                  subtitle: 'Selisih jam server',
                  icon: Icons.access_time,
                ),
                _typeCard(
                  type: 'TECHNICAL_ISSUE',
                  title: 'Masalah Teknis',
                  subtitle: 'GPS / Biometrik',
                  icon: Icons.build_circle_outlined,
                ),
              ],
            ),

            const SizedBox(height: 16),

            // 3. Waktu yang Dikoreksi
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'WAKTU SEBENARNYA (RILL)',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: AppColors.inkSecondary),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _inTime,
                          keyboardType: TextInputType.datetime,
                          decoration: InputDecoration(
                            labelText: 'Jam Masuk Baru',
                            hintText: 'Contoh: 07:00',
                            prefixIcon: const Icon(Icons.login, size: 18),
                            contentPadding: const EdgeInsets.all(12),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _outTime,
                          keyboardType: TextInputType.datetime,
                          decoration: InputDecoration(
                            labelText: 'Jam Pulang Baru',
                            hintText: 'Contoh: 14:15',
                            prefixIcon: const Icon(Icons.logout, size: 18),
                            contentPadding: const EdgeInsets.all(12),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 4. Alasan / Keterangan Keperluan
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ALASAN / JUSTIFIKASI KLINIS',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: AppColors.inkSecondary),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _reason,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Jelaskan alasan kendala presensi (contoh: HP lowbat, darurat tindakan pasien code blue, dsb)...',
                      hintStyle: const TextStyle(fontSize: 12, color: AppColors.outline),
                      contentPadding: const EdgeInsets.all(12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.errorTint,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.error),
                ),
                child: Text(_error!, style: const TextStyle(color: AppColors.errorText, fontSize: 12)),
              ),
            ],

            const SizedBox(height: 20),

            // 52px CTA Button
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryContainer,
                  foregroundColor: Colors.white,
                  elevation: 2,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _busy ? null : _submit,
                icon: const Icon(Icons.send, size: 18),
                label: Text(
                  _busy ? 'Mengirim Pengajuan...' : 'Ajukan Koreksi Presensi',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _typeCard({
    required String type,
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    final bool isSelected = _type == type;
    return InkWell(
      onTap: () => setState(() => _type = type),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceLow : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.primaryContainer : AppColors.border.withOpacity(0.6),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: isSelected ? AppColors.primaryContainer : AppColors.inkSecondary, size: 20),
                if (isSelected)
                  const Icon(Icons.check_circle, color: AppColors.primaryContainer, size: 16)
                else
                  Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.border),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: isSelected ? AppColors.primaryContainer : AppColors.ink,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 10, color: AppColors.outline),
            ),
          ],
        ),
      ),
    );
  }
}
