import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../data/schedule_repository.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen(
      {super.key, required this.schedules, this.onRequestLeave});

  final ScheduleRepository schedules;
  final VoidCallback? onRequestLeave;

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  late DateTime _weekStart;
  List<ScheduleEntry> _entries = const [];
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _weekStart = _mondayOf(DateTime.now());
    _load();
  }

  static DateTime _mondayOf(DateTime d) =>
      DateTime(d.year, d.month, d.day).subtract(Duration(days: d.weekday - 1));

  DateTime get _weekEnd => _weekStart.add(const Duration(days: 6));

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final List<ScheduleEntry> rows =
          await widget.schedules.mySchedule(from: _weekStart, to: _weekEnd);
      if (!mounted) return;
      setState(() {
        _entries = rows;
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat jadwal. Periksa koneksi server.';
        _busy = false;
      });
    }
  }

  void _shiftWeek(int weeks) {
    setState(() => _weekStart = _weekStart.add(Duration(days: 7 * weeks)));
    _load();
  }

  ScheduleEntry? _entryFor(DateTime day) {
    for (final ScheduleEntry e in _entries) {
      final DateTime d = e.workDate;
      if (d.year == day.year && d.month == day.month && d.day == day.day) {
        return e;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final int dutyDays = _entries.length;
    final int offDays = (7 - dutyDays).clamp(0, 7);
    final int nightShifts =
        _entries.where((e) => e.overnight || e.kind == ShiftKind.malam).length;

    final List<int> knownHours =
        _entries.map((e) => e.durationHours).whereType<int>().toList();
    final int totalHours = knownHours.fold(0, (sum, h) => sum + h);

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('RS Absen',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary)),
            Text('Roster Dinas & Kehadiran',
                style: TextStyle(fontSize: 11, color: AppColors.inkSecondary)),
          ],
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Sinkronisasi Roster',
            icon:
                const Icon(Icons.sync, size: 20, color: AppColors.inkSecondary),
            onPressed: _load,
          ),
          IconButton(
            tooltip: 'Notifikasi Shift',
            icon: const Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(Icons.notifications_outlined,
                    size: 22, color: AppColors.inkSecondary),
                Positioned(
                  top: -2,
                  right: -2,
                  child:
                      CircleAvatar(radius: 4, backgroundColor: AppColors.error),
                ),
              ],
            ),
            onPressed: () {},
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.calendar_month,
                            color: AppColors.primary, size: 20),
                        SizedBox(width: 6),
                        Text(
                          'Jadwal Dinas & Shift',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Roster Kerja Ruang Rawat Inap Melati',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.inkSecondary),
                    ),
                  ],
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(AppColors.radiusFull),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.edit_calendar,
                          size: 14, color: AppColors.primary),
                      SizedBox(width: 4),
                      Text(
                        'Bulan Ini',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      InkWell(
                        onTap: _busy ? null : () => _shiftWeek(-1),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.chevron_left,
                              size: 18, color: AppColors.inkSecondary),
                        ),
                      ),
                      Column(
                        children: [
                          Text(
                            _formatWeekRange(_weekStart, _weekEnd),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primaryFixed.withOpacity(0.35),
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusFull),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                CircleAvatar(
                                    radius: 3,
                                    backgroundColor: AppColors.primary),
                                SizedBox(width: 4),
                                Text(
                                  'Minggu Berjalan (Aktif)',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      InkWell(
                        onTap: _busy ? null : () => _shiftWeek(1),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.chevron_right,
                              size: 18, color: AppColors.inkSecondary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceLow,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            children: [
                              const Text('Total Beban',
                                  style: TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.inkSecondary)),
                              const SizedBox(height: 2),
                              Text(
                                knownHours.isEmpty ? '—' : '$totalHours Jam',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceLow,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            children: [
                              const Text('Rasio Shift',
                                  style: TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.inkSecondary)),
                              const SizedBox(height: 2),
                              Text(
                                '${dutyDays}D : ${offDays}L',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceLow,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            children: [
                              const Text('Shift Malam',
                                  style: TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.inkSecondary)),
                              const SizedBox(height: 2),
                              Text(
                                '$nightShifts Shift',
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.secondary),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'HARI & PENUGASAN KLINIK',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: AppColors.inkSecondary,
                  ),
                ),
                Text(
                  '7 Hari Kerja Roster',
                  style: TextStyle(fontSize: 11, color: AppColors.outline),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_busy)
              const LoadingState(label: 'Memuat roster mingguan')
            else if (_error != null)
              const InfoBanner(
                'Gagal memuat jadwal. Periksa koneksi server.',
                tone: InfoBannerTone.error,
                title: 'Tidak dapat memuat jadwal',
              )
            else
              for (int i = 0; i < 7; i++)
                _dayTile(_weekStart.add(Duration(days: i))),
            const SizedBox(height: 12),
            _legend(),
            const SizedBox(height: 12),
            _leaveCta(),
          ],
        ),
      ),
    );
  }

  String _formatWeekRange(DateTime start, DateTime end) {
    const List<String> months = [
      '',
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
      'Des'
    ];
    return '${start.day} ${months[start.month]} - ${end.day} ${months[end.month]} ${end.year}';
  }

  Widget _dayTile(DateTime day) {
    final ScheduleEntry? e = _entryFor(day);
    final bool isToday = DateUtils.isSameDay(day, DateTime.now());
    final bool isPast = day.isBefore(DateTime(
        DateTime.now().year, DateTime.now().month, DateTime.now().day));
    const List<String> hari = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];

    final bool isNight =
        e != null && (e.overnight || e.kind == ShiftKind.malam);
    final IconData shiftIcon = isNight ? Icons.bedtime : Icons.wb_sunny;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color:
              isToday ? AppColors.primary : AppColors.border.withOpacity(0.5),
          width: isToday ? 1.8 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isToday ? 0.05 : 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isToday
                        ? AppColors.primaryContainer
                        : (e == null
                            ? AppColors.dividerSoft
                            : AppColors.surfaceLow),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isToday
                          ? AppColors.primaryContainer
                          : AppColors.border.withOpacity(0.6),
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        hari[day.weekday - 1],
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: isToday
                              ? const Color(0xFF89F5E7)
                              : AppColors.inkSecondary,
                        ),
                      ),
                      Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isToday ? Colors.white : AppColors.ink,
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
                          Text(
                            e == null ? 'Libur' : e.shiftName,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: isToday
                                  ? AppColors.primary.withOpacity(0.12)
                                  : (e == null
                                      ? AppColors.surfaceLow
                                      : (isPast
                                          ? AppColors.surfaceLow
                                          : AppColors.surfaceLow)),
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusFull),
                              border: Border.all(
                                color: isToday
                                    ? AppColors.primary
                                    : AppColors.border,
                              ),
                            ),
                            child: Text(
                              e == null
                                  ? 'Libur'
                                  : (isToday
                                      ? 'HARI INI'
                                      : (isPast ? 'Selesai' : 'Mendatang')),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: isToday
                                    ? AppColors.primary
                                    : AppColors.inkSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      if (e != null) ...[
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceLow,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                    color: AppColors.border.withOpacity(0.6)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(shiftIcon,
                                      size: 12, color: AppColors.secondary),
                                  const SizedBox(width: 4),
                                  Text(
                                    e.window,
                                    style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.secondary),
                                  ),
                                ],
                              ),
                            ),
                            if (e.durationHours != null) ...[
                              const SizedBox(width: 6),
                              Text(
                                '${e.durationHours} Jam',
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.outline),
                              ),
                            ],
                          ],
                        ),
                      ] else ...[
                        const Text(
                          'Tidak ada penugasan dinas pada hari ini.',
                          style: TextStyle(
                              fontSize: 11.5, color: AppColors.outline),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            if (e != null && (e.overnight || e.kind == ShiftKind.malam)) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.secondaryFixed.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.nightlight,
                        size: 13, color: AppColors.secondary),
                    SizedBox(width: 4),
                    Text(
                      'Melewati Tengah Malam +1 Hari',
                      style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.secondary),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _legend() => Container(
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
              'Pedoman Kode Dinas RS',
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: AppColors.ink),
            ),
            const SizedBox(height: 8),
            _legendRow(
                color: AppColors.primary,
                title: 'Pagi (P)',
                time: '07:00 – 15:00 WIB'),
            _legendRow(
                color: AppColors.secondary,
                title: 'Siang (S)',
                time: '14:00 – 21:00 WIB'),
            _legendRow(
                color: AppColors.primaryContainer,
                title: 'Malam (M)',
                time: '21:00 – 07:00 WIB (+1)'),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.secondary.withOpacity(0.4)),
              ),
              child: const Text(
                'Lintas Hari (+1)',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.secondary),
              ),
            ),
          ],
        ),
      );

  Widget _legendRow(
      {required Color color, required String title, required String time}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(title,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink)),
          const Spacer(),
          Text(time,
              style: const TextStyle(
                  fontSize: 11.5, color: AppColors.inkSecondary)),
        ],
      ),
    );
  }

  Widget _leaveCta() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceLow,
          borderRadius: BorderRadius.circular(AppColors.radiusCard),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.swap_horiz, color: AppColors.primary, size: 20),
                SizedBox(width: 8),
                Text(
                  'Ajukan Tukar Shift',
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                      color: AppColors.primary),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Sesuai SOP Keperawatan, permohonan wajib diajukan maksimal 1x24 jam sebelum shift dimulai dan diverifikasi Kepala Ruangan.',
              style: TextStyle(
                  fontSize: 11.5, color: AppColors.inkSecondary, height: 1.35),
            ),
            if (widget.onRequestLeave != null) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: AppColors.buttonHeight,
                child: FilledButton.icon(
                  onPressed: widget.onRequestLeave,
                  icon: const Icon(Icons.published_with_changes, size: 20),
                  label: const Text('Formulir Tukar Jaga Online'),
                ),
              ),
            ],
          ],
        ),
      );
}
