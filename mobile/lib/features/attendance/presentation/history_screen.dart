// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';

import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../correction/data/correction_repository.dart';
import '../../correction/presentation/correction_form_screen.dart';
import '../../../core/theme/app_colors.dart';

String clockHm(String? iso) {
  if (iso == null) return '--:--';
  final DateTime? d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '--:--';
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

String clockHms(String? iso) {
  if (iso == null) return '--:--:--';
  final DateTime? d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '--:--:--';
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}:${d.second.toString().padLeft(2, '0')}';
}

String formatWorkDateId(String ymd) {
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

String formatWorkDateLongId(String ymd) {
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
  return '${hari[d.weekday - 1]}, ${d.day} ${bulan[d.month - 1]} ${d.year}';
}

String? effectiveDurationLabel(String? inIso, String? outIso) {
  final DateTime? a = inIso == null ? null : DateTime.tryParse(inIso);
  final DateTime? b = outIso == null ? null : DateTime.tryParse(outIso);
  if (a == null || b == null) return null;
  final Duration diff = b.difference(a);
  if (diff.isNegative) return null;
  return '${diff.inHours} Jam ${diff.inMinutes % 60} Menit';
}

String dateKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _initials(String name) {
  final List<String> parts =
      name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '—';
  if (parts.length == 1) {
    return parts.first
        .substring(0, parts.first.length >= 2 ? 2 : 1)
        .toUpperCase();
  }
  return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
}

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({
    super.key,
    required this.attendance,
    this.corrections,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
  });

  final AttendanceRepository attendance;
  final CorrectionRepository? corrections;
  final String displayName;
  final String employeeNo;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  static const Map<String, String> _filters = {
    '': 'Semua',
    'ON_TIME': 'Tepat Waktu',
    'LATE': 'Terlambat',
    'VERY_LATE': 'Sangat Terlambat',
  };

  String _status = '';
  late DateTime _month;
  List<AttendanceHistoryItem> _items = [];
  bool _busy = false;
  String? _error;

  static const List<String> _months = [
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

  @override
  void initState() {
    super.initState();
    final DateTime now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _load(reset: true);
  }

  DateTime get _monthEnd => DateTime(_month.year, _month.month + 1, 0);

  String get _monthLabel => '${_months[_month.month - 1]} ${_month.year}';

  Future<void> _load({bool reset = false}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      if (reset) _items = [];
    });
    try {
      final AttendanceHistoryPage result = await widget.attendance.myHistory(
        page: 1,
        checkInStatus: _status.isEmpty ? null : _status,
        from: dateKey(_month),
        to: dateKey(_monthEnd),
      );
      if (!mounted) return;
      setState(() {
        _items = result.items;
        _busy = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Gagal memuat riwayat presensi.';
          _busy = false;
        });
      }
    }
  }

  void _shiftMonth(int delta) {
    setState(() => _month = DateTime(_month.year, _month.month + delta));
    _load(reset: true);
  }

  Future<void> _pickMonthDialog() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _month,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      initialDatePickerMode: DatePickerMode.year,
      helpText: 'PILIH PERIODE BULAN',
      confirmText: 'PILIH',
      cancelText: 'BATAL',
    );
    if (picked != null) {
      setState(() {
        _month = DateTime(picked.year, picked.month);
      });
      _load(reset: true);
    }
  }

  void _pickFilter(String value) {
    if (value == _status) return;
    setState(() => _status = value);
    _load(reset: true);
  }

  Map<String, List<AttendanceHistoryItem>> get _grouped {
    final Map<String, List<AttendanceHistoryItem>> out = {};
    for (final AttendanceHistoryItem i in _items) {
      out.putIfAbsent(i.workDate, () => <AttendanceHistoryItem>[]).add(i);
    }
    return out;
  }

  int get _onTimeCount =>
      _items.where((i) => i.checkInStatus == 'ON_TIME').length;

  int get _lateCount => _items
      .where((i) => i.checkInStatus == 'LATE' || i.checkInStatus == 'VERY_LATE')
      .length;

  int get _reviewCount => _items.where((i) => i.needsReview).length;

  double get _attendanceRate =>
      _items.isEmpty ? 0 : (_onTimeCount / _items.length) * 100;

  String _dayHeaderLabel(String workDate) {
    final DateTime now = DateTime.now();
    final String todayKey = dateKey(now);
    final String yesterdayKey = dateKey(now.subtract(const Duration(days: 1)));
    if (workDate == todayKey) {
      return 'Hari Ini • ${formatWorkDateId(workDate)}';
    } else if (workDate == yesterdayKey) {
      return 'Kemarin • ${formatWorkDateId(workDate)}';
    }
    return formatWorkDateId(workDate);
  }

  bool _isToday(String workDate) {
    final DateTime now = DateTime.now();
    return workDate == dateKey(now);
  }

  @override
  Widget build(BuildContext context) {
    final Map<String, List<AttendanceHistoryItem>> groups = _grouped;

    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.primaryContainer,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.inversePrimary, width: 1.5),
              ),
              child: Center(
                child: Text(
                  _initials(widget.displayName),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Riwayat Presensi',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  Text(
                    widget.displayName +
                        (widget.employeeNo != '—' &&
                                widget.employeeNo.isNotEmpty
                            ? ' • ${widget.employeeNo}'
                            : ''),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.inkSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Mengunduh rekap riwayat presensi...'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            icon: const Icon(Icons.download_outlined, color: AppColors.primary),
            tooltip: 'Unduh rekap PDF',
          ),
          IconButton(
            onPressed: () => _load(reset: true),
            icon: const Icon(Icons.refresh, color: AppColors.inkSecondary),
            tooltip: 'Segarkan data',
          ),
        ],
      ),
      body: Column(
        children: [
          _monthBar(),
          _filterChips(),
          const Divider(height: 1, color: AppColors.surfaceHigh),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => _load(reset: true),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.only(bottom: 24),
                children: [
                  _statsStrip(),
                  if (_busy && _items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: CircularProgressIndicator(
                          valueColor:
                              AlwaysStoppedAnimation<Color>(AppColors.primary),
                        ),
                      ),
                    )
                  else if (_error != null && _items.isEmpty)
                    Container(
                      margin: const EdgeInsets.all(16),
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.border.withOpacity(0.5),
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 40,
                            color: AppColors.error,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            _error!,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.roseText,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 14),
                          FilledButton.icon(
                            onPressed: () => _load(reset: true),
                            icon: const Icon(Icons.refresh, size: 16),
                            label: const Text('Coba Lagi'),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (groups.isEmpty)
                    Container(
                      margin: const EdgeInsets.all(16),
                      padding: const EdgeInsets.symmetric(
                          vertical: 36, horizontal: 20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.border.withOpacity(0.5),
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.event_busy_outlined,
                            size: 44,
                            color: AppColors.outline,
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Tidak Ada Catatan Presensi',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Tidak ditemukan riwayat dinas pada $_monthLabel'
                            '${_status.isNotEmpty ? ' untuk filter ${_filters[_status]}' : ''}.',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.inkSecondary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    for (final MapEntry<String, List<AttendanceHistoryItem>> e
                        in groups.entries) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                        child: Row(
                          children: [
                            if (_isToday(e.key)) ...[
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                            ],
                            Text(
                              _dayHeaderLabel(e.key),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: _isToday(e.key)
                                    ? AppColors.primary
                                    : AppColors.ink,
                                letterSpacing: 0.2,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              '${e.value.length} Shift',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.outline,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      for (final AttendanceHistoryItem item in e.value)
                        _attendanceCard(item),
                    ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _monthBar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
      child: Row(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: _busy ? null : () => _shiftMonth(-1),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.canvas,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.border.withOpacity(0.6),
                ),
              ),
              child: const Icon(
                Icons.chevron_left,
                size: 20,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: _busy ? null : _pickMonthDialog,
              child: Container(
                height: 38,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.canvas,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.border.withOpacity(0.6),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.calendar_month,
                      size: 16,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _monthLabel,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.arrow_drop_down,
                      size: 18,
                      color: AppColors.outline,
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: _busy ? null : () => _shiftMonth(1),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.canvas,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.border.withOpacity(0.6),
                ),
              ),
              child: const Icon(
                Icons.chevron_right,
                size: 20,
                color: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChips() {
    return Container(
      color: Colors.white,
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        children: [
          for (final MapEntry<String, String> e in _filters.entries) ...[
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => _pickFilter(e.key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color:
                        _status == e.key ? AppColors.primary : AppColors.canvas,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _status == e.key
                          ? AppColors.primary
                          : AppColors.border.withOpacity(0.6),
                    ),
                    boxShadow: _status == e.key
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.12),
                              blurRadius: 4,
                              offset: Offset(0, 1),
                            ),
                          ]
                        : null,
                  ),
                  child: Center(
                    child: Text(
                      e.value,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: _status == e.key
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: _status == e.key
                            ? Colors.white
                            : AppColors.inkSecondary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _statsStrip() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.border.withOpacity(0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withOpacity(0.04),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
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
                    'REKAP ${_monthLabel.toUpperCase()}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.1,
                      color: AppColors.outline,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${_items.length} Catatan Dinas',
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.successTint,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.successBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.verified,
                      size: 14,
                      color: AppColors.successText,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Disiplin ${_attendanceRate.toStringAsFixed(0)}%',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.successText,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 1,
            color: AppColors.border.withOpacity(0.3),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _kpiBox(
                label: 'Kehadiran',
                value: '${_attendanceRate.toStringAsFixed(0)}%',
                color: AppColors.primary,
              ),
              const SizedBox(width: 6),
              _kpiBox(
                label: 'Tepat Waktu',
                value: '$_onTimeCount',
                color: AppColors.success,
              ),
              const SizedBox(width: 6),
              _kpiBox(
                label: 'Terlambat',
                value: '$_lateCount',
                color: AppColors.warning,
              ),
              const SizedBox(width: 6),
              _kpiBox(
                label: 'Izin/Review',
                value: '$_reviewCount',
                color: AppColors.secondary,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _kpiBox({
    required String label,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          color: AppColors.canvas,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: AppColors.border.withOpacity(0.25),
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w500,
                color: AppColors.inkSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _attendanceCard(AttendanceHistoryItem item) {
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
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openDetail(item),
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

  void _openDetail(AttendanceHistoryItem item) {
    final BuildContext outer = context;
    showModalBottomSheet<void>(
      context: outer,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DetailSheet(
        item: item,
        corrections: widget.corrections,
        onRequestCorrection: () {
          Navigator.of(outer).pop();
          if (widget.corrections != null) {
            Navigator.of(outer).push(
              MaterialPageRoute(
                builder: (_) => CorrectionFormScreen(
                  corrections: widget.corrections!,
                  attendanceId: item.id,
                  workDate: item.workDate,
                  displayName: widget.displayName,
                  employeeNo: widget.employeeNo,
                ),
              ),
            );
          }
        },
      ),
    );
  }
}

class _DetailSheet extends StatelessWidget {
  const _DetailSheet({
    required this.item,
    required this.corrections,
    required this.onRequestCorrection,
  });

  final AttendanceHistoryItem item;
  final CorrectionRepository? corrections;
  final VoidCallback onRequestCorrection;

  @override
  Widget build(BuildContext context) {
    final bool lowRisk = item.riskCategory == 'LOW';
    final String? duration =
        effectiveDurationLabel(item.checkInAt, item.checkOutAt);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withOpacity(0.10),
            blurRadius: 20,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.88,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.badge_outlined,
                        size: 20,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Detail Bukti Presensi',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                          Text(
                            'Stempel Digital SIMRS Darmayu Madiun',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.inkSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          color: AppColors.surfaceLow,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.close,
                          size: 18,
                          color: AppColors.inkSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                height: 1,
                color: AppColors.border.withOpacity(0.3),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildVerificationBanner(lowRisk),
                      const SizedBox(height: 14),
                      _buildTimeSection(duration),
                      const SizedBox(height: 14),
                      _buildBiometricSection(lowRisk),
                      const SizedBox(height: 14),
                      _buildLedgerSection(),
                      if (corrections != null) ...[
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: OutlinedButton.icon(
                            onPressed: onRequestCorrection,
                            icon: const Icon(Icons.edit_calendar, size: 18),
                            label: const Text('Ajukan Koreksi Presensi'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.primary,
                              side: const BorderSide(color: AppColors.primary),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    top: BorderSide(
                      color: AppColors.border.withOpacity(0.35),
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                    'Mengunduh bukti presensi ${item.workDate}.pdf...'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          icon: const Icon(Icons.picture_as_pdf, size: 18),
                          label: const Text(
                            'Unduh PDF',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.ink,
                            backgroundColor: AppColors.surfaceLow,
                            side: BorderSide(
                              color: AppColors.border.withOpacity(0.8),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: FilledButton.icon(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.check, size: 18),
                          label: const Text(
                            'Tutup Detail',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVerificationBanner(bool lowRisk) {
    final bool onTime = item.checkInStatus == 'ON_TIME';
    final Color bg = onTime ? AppColors.successTint : AppColors.warningTint;
    final Color border =
        onTime ? AppColors.successBorder : AppColors.warningBorder;
    final Color fg = onTime ? AppColors.successText : AppColors.warningText;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: fg,
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Icon(Icons.check_circle, color: Colors.white, size: 20),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.checkInAt == null
                      ? 'Tidak Hadir Presensi'
                      : (onTime
                          ? 'Presensi Masuk Tepat Waktu'
                          : 'Presensi Masuk Tercatat'),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: fg,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.shiftName ?? 'Shift'} • ${formatWorkDateLongId(item.workDate)}',
                  style: TextStyle(
                    fontSize: 11,
                    color: fg.withOpacity(0.85),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: border),
            ),
            child: Text(
              lowRisk ? 'TERVALIDASI' : 'REVIEW',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: fg,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeSection(String? duration) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.canvas,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.border.withOpacity(0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.schedule, size: 16, color: AppColors.primary),
              SizedBox(width: 6),
              Text(
                'Pencatatan Waktu Kerja',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.border.withOpacity(0.3),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Presensi Masuk',
                        style: TextStyle(
                            fontSize: 11, color: AppColors.inkSecondary),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.checkInAt == null
                            ? '--:--:--'
                            : '${clockHms(item.checkInAt)} WIB',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                      const SizedBox(height: 3),
                      const Row(
                        children: [
                          Icon(Icons.cloud_done,
                              size: 12, color: AppColors.successText),
                          SizedBox(width: 3),
                          Text(
                            'Server SIMRS Sync',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: AppColors.successText,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.border.withOpacity(0.3),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Presensi Pulang',
                        style: TextStyle(
                            fontSize: 11, color: AppColors.inkSecondary),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.checkOutAt == null
                            ? '--:--:--'
                            : '${clockHms(item.checkOutAt)} WIB',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.checkOutAt == null
                            ? 'Belum checkout'
                            : checkOutStatusLabel(item.checkOutStatus),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: AppColors.secondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (duration != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.border.withOpacity(0.3),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total Durasi Efektif:',
                    style:
                        TextStyle(fontSize: 11, color: AppColors.inkSecondary),
                  ),
                  Text(
                    duration,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBiometricSection(bool lowRisk) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.canvas,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.border.withOpacity(0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.fingerprint, size: 16, color: AppColors.primary),
              SizedBox(width: 6),
              Text(
                'Verifikasi Biometrik Face ID',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.border.withOpacity(0.3),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.primary,
                      width: 1.5,
                    ),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.face_retouching_natural,
                        size: 22,
                        color: AppColors.primary,
                      ),
                      Text(
                        'VALID',
                        style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Integritas Biometrik',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                          Text(
                            lowRisk ? 'Lolos Verifikasi' : 'Perlu Review',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: lowRisk
                                  ? AppColors.successText
                                  : AppColors.warningText,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Anti-spoofing face mesh tervalidasi real-time tanpa penundaan.',
                        style: TextStyle(
                            fontSize: 10.5, color: AppColors.inkSecondary),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Skor Risiko: ${item.riskScore ?? 0} • ${riskCategoryLabel(item.riskCategory)}'
                        '${item.needsReview ? ' • Review Supervisor' : ''}',
                        style: const TextStyle(
                          fontSize: 10,
                          color: AppColors.outline,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLedgerSection() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.canvas,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: AppColors.border.withOpacity(0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              'SIMRS ID: PRS-${item.id.length > 18 ? item.id.substring(0, 18) : item.id}',
              style: const TextStyle(
                fontSize: 10,
                color: AppColors.inkSecondary,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.verified_user, size: 13, color: AppColors.primary),
              SizedBox(width: 4),
              Text(
                'SHA-256 Valid',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

