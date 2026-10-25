import 'package:flutter/material.dart';

import '../data/leave_repository.dart';
import '../domain/leave_models.dart';
import 'leave_form_screen.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';

const List<String> _bulanPendekId = [
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

String _formatLeaveRange(String startKey, String endKey) {
  final DateTime? s = DateTime.tryParse(startKey);
  final DateTime? e = DateTime.tryParse(endKey);
  if (s == null || e == null) return '$startKey  s/d  $endKey';
  final String sm = _bulanPendekId[s.month - 1];
  final String em = _bulanPendekId[e.month - 1];
  if (s.year == e.year && s.month == e.month && s.day == e.day) {
    return '${s.day} $sm ${s.year}';
  }
  if (s.year == e.year) return '${s.day} $sm - ${e.day} $em ${e.year}';
  return '${s.day} $sm ${s.year} - ${e.day} $em ${e.year}';
}

class LeaveListScreen extends StatefulWidget {
  const LeaveListScreen({
    super.key,
    required this.leaves,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
  });

  final LeaveRepository leaves;
  final String displayName;
  final String employeeNo;

  @override
  State<LeaveListScreen> createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> {
  late Future<List<LeaveItem>> _future;
  String _selectedFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _future = widget.leaves.myLeaves();
  }

  void _reload() => setState(() => _future = widget.leaves.myLeaves());

  Future<void> _openForm() async {
    final bool? done = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => LeaveFormScreen(
          leaves: widget.leaves,
          displayName: widget.displayName,
          employeeNo: widget.employeeNo,
        ),
      ),
    );
    if (done == true && mounted) {
      _reload();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Permohonan dispensasi berhasil dikirim ke Karu/HRD.'),
          backgroundColor: AppColors.primary,
        ),
      );
    }
  }

  static int _dayCount(String start, String end) {
    final DateTime? a = DateTime.tryParse(start);
    final DateTime? b = DateTime.tryParse(end);
    if (a == null || b == null) return 1;
    final int d = b.difference(a).inDays + 1;
    return d <= 0 ? 1 : d;
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
            Text('Riwayat Izin & Cuti',
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
        onPressed: _openForm,
        icon: const Icon(Icons.add),
        label: const Text('Ajukan Izin / Cuti',
            style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: FutureBuilder<List<LeaveItem>>(
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
                    const Text('Gagal memuat riwayat pengajuan.'),
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

          final List<LeaveItem> allItems = snap.data!;

          const int totalAnnualQuota = 12;
          int usedLeaveDays = 0;
          int sickDays = 0;
          int dutyDays = 0;
          int pendingForms = 0;

          for (final item in allItems) {
            final int count = _dayCount(item.startDate, item.endDate);
            if (item.status == 'APPROVED') {
              if (item.type == 'CUTI') usedLeaveDays += count;
              if (item.type == 'SAKIT') sickDays += count;
              if (item.type == 'DINAS') dutyDays += count;
            } else if (item.status == 'PENDING') {
              pendingForms++;
            }
          }

          final int remainingQuota =
              (totalAnnualQuota - usedLeaveDays).clamp(0, totalAnnualQuota);
          final double usedRatio =
              (usedLeaveDays / totalAnnualQuota).clamp(0.0, 1.0);
          final int approvedCount =
              allItems.where((l) => l.status == 'APPROVED').length;
          final int rejectedCount =
              allItems.where((l) => l.status == 'REJECTED').length;

          final List<LeaveItem> filteredItems = allItems.where((l) {
            if (_selectedFilter == 'ALL') return true;
            return l.status == _selectedFilter;
          }).toList();

          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border:
                        Border.all(color: AppColors.border.withOpacity(0.5)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Container(height: 4, color: AppColors.primaryContainer),
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Row(
                                      children: [
                                        Icon(Icons.verified_user,
                                            size: 16, color: AppColors.primary),
                                        SizedBox(width: 6),
                                        Text(
                                          'Ringkasan Kuota Cuti',
                                          style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.inkSecondary),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.baseline,
                                      textBaseline: TextBaseline.alphabetic,
                                      children: [
                                        Text(
                                          '$remainingQuota',
                                          style: const TextStyle(
                                            fontSize: 28,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.primaryContainer,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        const Text(
                                          'Hari Tersisa',
                                          style: TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.ink),
                                        ),
                                      ],
                                    ),
                                    Text(
                                      'Dari total kuota hak cuti 12 hari • Periode ${DateTime.now().year}',
                                      style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.outline),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceLow,
                                    borderRadius: BorderRadius.circular(
                                        AppColors.radiusFull),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Text(
                                    'Aktif ${DateTime.now().year}',
                                    style: const TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.primary),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Terpakai: $usedLeaveDays Hari (${(usedRatio * 100).round()}%)',
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.inkSecondary),
                                ),
                                Text(
                                  'Tersedia: $remainingQuota Hari',
                                  style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.primaryContainer),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusFull),
                              child: LinearProgressIndicator(
                                value: usedRatio,
                                minHeight: 7,
                                backgroundColor: AppColors.surfaceLow,
                                color: AppColors.primaryContainer,
                              ),
                            ),
                            const SizedBox(height: 14),
                            const Divider(height: 1),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                    child: _bentoStat(
                                        'Terpakai', '$usedLeaveDays Hari')),
                                const SizedBox(width: 6),
                                Expanded(
                                    child:
                                        _bentoStat('Sakit', '$sickDays Hari')),
                                const SizedBox(width: 6),
                                Expanded(
                                    child: _bentoStat(
                                        'Dinas Luar', '$dutyDays Hari')),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: _bentoStat(
                                    'Pending',
                                    '$pendingForms Form',
                                    isHighlight: pendingForms > 0,
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'DAFTAR PENGAJUAN',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.6,
                          color: AppColors.inkSecondary),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusFull),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_today,
                              size: 12, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text('Tahun ${DateTime.now().year}',
                              style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.ink)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _filterChip('ALL', 'Semua (${allItems.length})'),
                      const SizedBox(width: 6),
                      _filterChip('PENDING', 'Menunggu ($pendingForms)'),
                      const SizedBox(width: 6),
                      _filterChip('APPROVED', 'Disetujui ($approvedCount)'),
                      const SizedBox(width: 6),
                      _filterChip('REJECTED', 'Ditolak ($rejectedCount)'),
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
                        Icon(Icons.beach_access,
                            size: 40, color: AppColors.border),
                        SizedBox(height: 8),
                        Text(
                          'Tidak ada pengajuan pada kategori ini',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.inkSecondary),
                        ),
                      ],
                    ),
                  )
                else
                  for (final item in filteredItems) _leaveCard(item),
                const SizedBox(height: 48),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _bentoStat(String title, String value, {bool isHighlight = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      decoration: BoxDecoration(
        color: isHighlight ? AppColors.warningTint : AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(AppColors.radiusCardSmall),
        border: Border.all(
            color: isHighlight ? AppColors.warningBorder : AppColors.border),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 9.5,
              color: isHighlight ? AppColors.warningText : AppColors.outline,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: isHighlight ? AppColors.warningText : AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String code, String label) {
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

  Widget _leaveCard(LeaveItem l) {
    final int days = _dayCount(l.startDate, l.endDate);
    final (
      Color stripeColor,
      Color bgPill,
      Color textPill,
      String statusLabel
    ) = switch (l.status) {
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
          AppColors.roseTextDark,
          'Ditolak',
        ),
      _ => (
          AppColors.inkDisabled,
          AppColors.surfaceLow,
          AppColors.inkSecondary,
          l.status,
        ),
    };

    final IconData icon = switch (l.type) {
      'CUTI' => Icons.beach_access,
      'SAKIT' => Icons.medical_services,
      'IZIN' => Icons.person,
      'DINAS' => Icons.school,
      _ => Icons.event_note,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
          Container(height: 3, color: stripeColor),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(icon, size: 18, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Text(
                          leaveTypes[l.type] ?? l.type,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
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
                Row(
                  children: [
                    const Icon(Icons.calendar_today,
                        size: 12, color: AppColors.outline),
                    const SizedBox(width: 5),
                    Text(
                      _formatLeaveRange(l.startDate, l.endDate),
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.inkSecondary),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '$days Hari Kerja',
                        style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  l.reason,
                  style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.inkSecondary,
                      height: 1.35),
                ),
                if (l.reviewNote?.isNotEmpty == true) ...[
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
                      'Catatan Karu/HRD: ${l.reviewNote}',
                      style: const TextStyle(
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                          color: AppColors.primary),
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
