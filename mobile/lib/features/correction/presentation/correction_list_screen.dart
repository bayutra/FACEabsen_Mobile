import 'package:flutter/material.dart';

import '../../attendance/data/attendance_repository.dart';
import '../../attendance/presentation/history_screen.dart';
import '../data/correction_repository.dart';
import '../domain/correction_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';

String _formatWorkDate(String? ymd, {String fallback = 'Presensi Terkait'}) {
  if (ymd == null || ymd.isEmpty) return fallback;
  final DateTime? d = DateTime.tryParse(ymd);
  if (d == null) return ymd;
  const List<String> hari = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu'
  ];
  const List<String> bulan = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  return '${hari[d.weekday - 1]}, ${d.day} ${bulan[d.month - 1]} ${d.year}';
}

String _monthBadge(DateTime d) {
  const List<String> bulan = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return '${bulan[d.month - 1]} ${d.year}';
}

class CorrectionListScreen extends StatefulWidget {
  const CorrectionListScreen({
    super.key,
    required this.corrections,
    this.attendance,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
  });

  final CorrectionRepository corrections;

  final AttendanceRepository? attendance;
  final String displayName;
  final String employeeNo;

  @override
  State<CorrectionListScreen> createState() => _CorrectionListScreenState();
}

class _CorrectionListScreenState extends State<CorrectionListScreen> {
  late Future<List<CorrectionItem>> _future;
  String _selectedFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _future = widget.corrections.myCorrections();
  }

  void _reload() =>
      setState(() => _future = widget.corrections.myCorrections());

  Future<void> _openHistoryPicker() async {
    final AttendanceRepository? attendance = widget.attendance;
    if (attendance == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Riwayat presensi tidak tersedia.')),
        );
      }
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => HistoryScreen(
          attendance: attendance,
          corrections: widget.corrections,
          displayName: widget.displayName,
          employeeNo: widget.employeeNo,
        ),
      ),
    );
    if (mounted) _reload();
  }

  static String _initials(String name) {
    final List<String> parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '—';
    if (parts.length == 1) {
      final String p = parts.first;
      return p.substring(0, p.length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('RS Absen • Kepegawaian',
                style: TextStyle(
                    fontSize: 11,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600)),
            Text('Status Koreksi Presensi',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink)),
          ],
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.inkSecondary),
            onPressed: _reload,
            tooltip: 'Segarkan',
          ),
          const SizedBox(width: 8),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primaryContainer,
        foregroundColor: Colors.white,
        onPressed: _openHistoryPicker,
        icon: const Icon(Icons.edit_calendar),
        label: const Text('Ajukan Koreksi',
            style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: FutureBuilder<List<CorrectionItem>>(
        future: _future,
        builder: (context, snap) {
          if (!snap.hasData) {
            if (snap.hasError) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 36, color: AppColors.error),
                    const SizedBox(height: 8),
                    const Text('Gagal memuat daftar koreksi.'),
                    const SizedBox(height: 12),
                    FilledButton(
                        onPressed: _reload, child: const Text('Coba Lagi')),
                  ],
                ),
              );
            }
            return const Center(
                child: CircularProgressIndicator(color: AppColors.primary));
          }

          final List<CorrectionItem> allItems = snap.data!;

          final int total = allItems.length;
          final int pending =
              allItems.where((c) => c.status == 'PENDING').length;
          final int approved =
              allItems.where((c) => c.status == 'APPROVED').length;
          final int rejected =
              allItems.where((c) => c.status == 'REJECTED').length;

          final List<CorrectionItem> filteredItems = allItems.where((c) {
            if (_selectedFilter == 'ALL') return true;
            return c.status == _selectedFilter;
          }).toList();

          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border:
                        Border.all(color: AppColors.border.withOpacity(0.5)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: AppColors.primaryContainer,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Text(
                                _initials(widget.displayName),
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.displayName,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'NIK ${widget.employeeNo}',
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.outline),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLow,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusFull),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          _monthBadge(DateTime.now()),
                          style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: _kpiCard(
                        title: 'Total',
                        count: '$total',
                        subtitle: 'Pengajuan',
                        bgColor: Colors.white,
                        textColor: AppColors.ink,
                        borderColor: AppColors.border.withOpacity(0.5),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _kpiCard(
                        title: 'Menunggu',
                        count: '$pending',
                        subtitle: 'Verifikasi',
                        bgColor: AppColors.warningTint,
                        textColor: AppColors.warningText,
                        borderColor: AppColors.warningBorder,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _kpiCard(
                        title: 'Disetujui',
                        count: '$approved',
                        subtitle: 'Valid',
                        bgColor: AppColors.successTint,
                        textColor: AppColors.successText,
                        borderColor: AppColors.successBorder,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _kpiCard(
                        title: 'Ditolak',
                        count: '$rejected',
                        subtitle: 'Expired',
                        bgColor: AppColors.roseTint,
                        textColor: AppColors.roseText,
                        borderColor: AppColors.errorBorder,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _filterTab('ALL', 'Semua ($total)'),
                      const SizedBox(width: 6),
                      _filterTab('PENDING', 'Menunggu ($pending)'),
                      const SizedBox(width: 6),
                      _filterTab('APPROVED', 'Disetujui ($approved)'),
                      const SizedBox(width: 6),
                      _filterTab('REJECTED', 'Ditolak ($rejected)'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (filteredItems.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border:
                          Border.all(color: AppColors.border.withOpacity(0.5)),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.edit_calendar,
                            size: 40, color: AppColors.border),
                        SizedBox(height: 8),
                        Text(
                          'Belum ada pengajuan koreksi presensi',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.inkSecondary),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Buat pengajuan dari detail presensi di menu Riwayat Presensi.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 11.5, color: AppColors.outline),
                        ),
                      ],
                    ),
                  )
                else
                  for (final item in filteredItems) _correctionCard(item),
                const SizedBox(height: 40),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _kpiCard({
    required String title,
    required String count,
    required String subtitle,
    required Color bgColor,
    required Color textColor,
    required Color borderColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: 9.5,
                  color: textColor.withOpacity(0.85),
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 2),
          Text(count,
              style: TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w800, color: textColor)),
          Text(subtitle,
              style: TextStyle(fontSize: 9, color: textColor.withOpacity(0.7))),
        ],
      ),
    );
  }

  Widget _filterTab(String code, String label) {
    final bool active = _selectedFilter == code;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = code),
      child: AppPill(
        label,
        active ? AppColors.primaryContainer : AppColors.surfaceLowest,
        active ? Colors.white : AppColors.inkSecondary,
        border: active ? AppColors.primaryContainer : AppColors.border,
      ),
    );
  }

  Widget _correctionCard(CorrectionItem c) {
    final (
      Color stripeColor,
      Color bgPill,
      Color textPill,
      String statusLabel
    ) = switch (c.status) {
      'APPROVED' => (
          AppColors.success,
          AppColors.successTint,
          AppColors.successText,
          'Disetujui',
        ),
      'PENDING' => (
          AppColors.warning,
          AppColors.warningTint,
          AppColors.warningText,
          'Menunggu Review',
        ),
      'REJECTED' => (
          AppColors.roseFill,
          AppColors.roseTint,
          AppColors.roseText,
          'Ditolak',
        ),
      _ => (
          const Color(0xFF6B7280),
          const Color(0xFFF3F4F6),
          const Color(0xFF374151),
          c.status,
        ),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withOpacity(0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(height: 3.5, color: stripeColor),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ID: #${c.id.length > 8 ? c.id.substring(0, 8).toUpperCase() : c.id}',
                          style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.outline,
                              letterSpacing: 0.5),
                        ),
                        Text(
                          _formatWorkDate(c.workDate),
                          style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: bgPill,
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusFull),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: textPill),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.edit_note,
                          size: 16, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        correctionTypes[c.type] ?? c.type,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary),
                      ),
                      if (c.requestedCheckIn != null ||
                          c.requestedCheckOut != null) ...[
                        const Spacer(),
                        Text(
                          'Koreksi: ${c.requestedCheckIn != null ? 'In' : ''}${c.requestedCheckOut != null ? ' Out' : ''}',
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.inkSecondary),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  c.reason,
                  style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.inkSecondary,
                      height: 1.35),
                ),
                if (c.reviewNote?.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(8),
                      border:
                          Border.all(color: AppColors.primary.withOpacity(0.2)),
                    ),
                    child: Text(
                      'Catatan Karu: ${c.reviewNote}',
                      style: const TextStyle(
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                          color: AppColors.primary),
                    ),
                  ),
                ],
                if (c.status == 'PENDING') ...[
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      style: TextButton.styleFrom(
                          foregroundColor: AppColors.error),
                      onPressed: () async {
                        await widget.corrections.cancel(c.id);
                        _reload();
                      },
                      icon: const Icon(Icons.close, size: 15),
                      label: const Text('Batalkan Pengajuan',
                          style: TextStyle(
                              fontSize: 11.5, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
