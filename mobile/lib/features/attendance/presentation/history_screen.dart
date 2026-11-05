// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';

import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../correction/data/correction_repository.dart';
import '../../correction/presentation/correction_form_screen.dart';
import '../../../core/theme/app_colors.dart';
import 'history_attendance_card.dart';
import 'history_detail_sheet.dart';
import 'history_format.dart';

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
                  initials(widget.displayName),
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
                        HistoryAttendanceCard(item: item, onOpen: _openDetail),
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

  void _openDetail(AttendanceHistoryItem item) {
    final BuildContext outer = context;
    showModalBottomSheet<void>(
      context: outer,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => HistoryDetailSheet(
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
