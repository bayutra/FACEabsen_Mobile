import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../schedule/data/schedule_repository.dart';
import '../../schedule/domain/shift_status.dart';

class HomeDashboard extends StatefulWidget {
  const HomeDashboard({
    super.key,
    required this.attendance,
    required this.schedules,
    required this.displayName,
    required this.pendingDevices,
    required this.biometricConsent,
    required this.onToggleBiometric,
    required this.onStartAttendance,
    required this.onOpenCorrections,
    required this.onOpenLeaves,
    required this.onOpenSchedule,
    required this.onOpenProfile,
    this.onOpenHistory,
    this.onOpenAdmin,
    this.onOpenHandovers,
  });

  final AttendanceRepository attendance;
  final ScheduleRepository schedules;
  final String displayName;
  final int pendingDevices;
  final bool biometricConsent;
  final Future<void> Function(bool granted) onToggleBiometric;
  final VoidCallback onStartAttendance;
  final VoidCallback onOpenCorrections;
  final VoidCallback onOpenLeaves;
  final VoidCallback onOpenSchedule;
  final VoidCallback onOpenProfile;
  final VoidCallback? onOpenHistory;

  final VoidCallback? onOpenAdmin;
  final VoidCallback? onOpenHandovers;

  @override
  State<HomeDashboard> createState() => _HomeDashboardState();
}

class _HomeDashboardState extends State<HomeDashboard> {
  AttendanceHistoryItem? _today;
  List<ScheduleEntry> _week = const [];
  bool _busy = true;
  String? _error;
  bool _consentBusy = false;
  int _outboxCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  DateTime get _now => DateTime.now();

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final DateTime now = _now;
      final String todayKey = ScheduleRepository.dateKey(now);
      final DateTime monday = DateTime(now.year, now.month, now.day)
          .subtract(Duration(days: now.weekday - 1));

      final results = await Future.wait([
        widget.attendance.myHistory(from: todayKey, to: todayKey),
        widget.schedules.mySchedule(
          from: monday,
          to: monday.add(const Duration(days: 6)),
        ),
        widget.attendance.outbox().count(),
      ]);

      final todayPage = results[0] as AttendanceHistoryPage;
      final int outboxCount = results[2] as int;
      if (!mounted) return;
      setState(() {
        _today = todayPage.items.isEmpty ? null : todayPage.items.first;
        _week = results[1] as List<ScheduleEntry>;
        _outboxCount = outboxCount;
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat data beranda.';
        _busy = false;
      });
    }
  }

  Future<void> _toggleBiometric(bool value) async {
    setState(() => _consentBusy = true);
    try {
      await widget.onToggleBiometric(value);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(value
                ? 'Verifikasi wajah diaktifkan untuk presensi.'
                : 'Verifikasi wajah dimatikan. Presensi wajah akan ditolak.'),
          ),
        );
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _consentBusy = false);
    }
  }

  ScheduleEntry? get _todayShift {
    final DateTime now = _now;
    for (final ScheduleEntry e in _week) {
      if (e.workDate.year == now.year &&
          e.workDate.month == now.month &&
          e.workDate.day == now.day) {
        return e;
      }
    }
    return null;
  }

  bool get _needsCheckoutReminder {
    final AttendanceHistoryItem? t = _today;
    if (t == null || t.checkInAt == null || t.checkOutAt != null) return false;
    final ScheduleEntry? s = _todayShift;
    if (s == null) return false;
    final DateTime end = shiftEnd(
      s.workDate,
      s.endTime,
      s.startTime,
      s.overnight,
    );
    return _now.isAfter(end.add(const Duration(minutes: 30)));
  }

  static String _greeting() {
    final int h = DateTime.now().hour;
    if (h < 11) return 'Selamat Pagi,';
    if (h < 15) return 'Selamat Siang,';
    if (h < 18) return 'Selamat Sore,';
    return 'Selamat Malam,';
  }

  void _showNotifications() {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext ctx) {
        final List<_Notif> items = <_Notif>[];
        if (_outboxCount > 0) {
          items.add(_Notif(
            icon: Icons.cloud_off,
            color: AppColors.warningText,
            title: 'Presensi offline tertunda',
            body: '$_outboxCount presensi tersimpan di perangkat, akan dikirim saat online.',
          ));
        }
        if (widget.pendingDevices > 0) {
          items.add(_Notif(
            icon: Icons.devices_other_outlined,
            color: AppColors.primary,
            title: 'Perangkat menunggu aktivasi',
            body: '${widget.pendingDevices} perangkat belum diaktifkan admin.',
          ));
        }
        if (items.isEmpty) {
          items.add(const _Notif(
            icon: Icons.check_circle_outline,
            color: AppColors.successText,
            title: 'Tidak ada notifikasi',
            body: 'Semua presensi dan perangkat sudah sinkron.',
          ));
        }
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Notifikasi', style: AppText.headlineSm),
                const SizedBox(height: 12),
                ...items.map((_Notif n) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(n.icon, color: n.color, size: 22),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(n.title,
                                    style: AppText.bodyMdMedium
                                        .copyWith(color: AppColors.ink)),
                                Text(n.body,
                                    style: AppText.bodyMd
                                        .copyWith(color: AppColors.inkSecondary)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _adminBanner() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: widget.onOpenAdmin,
        borderRadius: BorderRadius.circular(AppColors.radiusCard),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.primaryFixed,
            borderRadius: BorderRadius.circular(AppColors.radiusCard),
            border: Border.all(color: AppColors.primaryContainer),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.admin_panel_settings_outlined,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Mode Admin',
                      style: AppText.labelMd.copyWith(
                        color: AppColors.onPrimaryFixed,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      'Kelola koreksi, izin, jadwal, karyawan & laporan',
                      style: AppText.labelSm.copyWith(
                        color: AppColors.onPrimaryFixed,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.onPrimaryFixed),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surfaceLowest,
            border: Border(bottom: BorderSide(color: AppColors.border)),
            boxShadow: AppColors.shadow1,
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppColors.pageMargin,
                vertical: 8,
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: widget.onOpenProfile,
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primaryContainer,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Center(
                        child: Text(
                          _avatarInitials(widget.displayName),
                          style: AppText.labelMd.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _greeting(),
                          style: AppText.labelSm
                              .copyWith(color: AppColors.inkSecondary),
                        ),
                        Text(
                          widget.displayName.isEmpty
                              ? 'Karyawan'
                              : widget.displayName,
                          style: AppText.headlineSm.copyWith(
                            color: AppColors.primary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _showNotifications,
                    icon: Stack(
                      children: [
                        const Icon(Icons.notifications_none,
                            color: AppColors.primary, size: 24),
                        if (_outboxCount + widget.pendingDevices > 0)
                          Positioned(
                            right: 0,
                            top: 0,
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                              ),
                              constraints: const BoxConstraints(
                                minWidth: 16,
                                minHeight: 16,
                              ),
                              child: Text(
                                '${_outboxCount + widget.pendingDevices}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                                textAlign: TextAlign.center,
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
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(AppColors.pageMargin),
          children: [
              if (_needsCheckoutReminder) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningTint,
                    borderRadius: BorderRadius.circular(AppColors.radiusCard),
                    border: Border.all(color: AppColors.warningBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.logout, color: AppColors.warningText, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Anda sudah check-in. Jangan lupa check-out setelah pulang.',
                          style: AppText.bodyMd.copyWith(
                            color: AppColors.warningText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_needsCheckoutReminder) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningTint,
                    borderRadius: BorderRadius.circular(AppColors.radiusCard),
                    border: Border.all(color: AppColors.warningBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.logout, color: AppColors.warningText, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Anda sudah check-in. Jangan lupa check-out setelah pulang.',
                          style: AppText.bodyMd.copyWith(
                            color: AppColors.warningText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_outboxCount > 0) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningTint,
                    borderRadius: BorderRadius.circular(AppColors.radiusCard),
                    border: Border.all(color: AppColors.warningBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off,
                          color: AppColors.warningText, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '$_outboxCount presensi tersimpan offline, akan dikirim saat online.',
                          style: AppText.bodyMd.copyWith(
                            color: AppColors.warningText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_outboxCount > 0) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningTint,
                    borderRadius: BorderRadius.circular(AppColors.radiusCard),
                    border: Border.all(color: AppColors.warningBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off,
                          color: AppColors.warningText, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '$_outboxCount presensi tersimpan offline, akan dikirim saat online.',
                          style: AppText.bodyMd.copyWith(
                            color: AppColors.warningText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
            if (widget.onOpenAdmin != null) ...[
              _adminBanner(),
              const SizedBox(height: 12),
            ],
            Row(
              children: [
                const Icon(Icons.local_hospital,
                    size: 18, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Instalasi Rawat Inap Melati - RSU Darmayu Madiun',
                    style: AppText.labelSm.copyWith(
                      color: AppColors.inkSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.secondaryFixed,
                    borderRadius: BorderRadius.circular(AppColors.radiusFull),
                    border: Border.all(color: AppColors.secondaryFixedDim),
                  ),
                  child: Text(
                    'PNS / Tetap',
                    style: AppText.labelSm.copyWith(
                      color: AppColors.onSecondaryFixed,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (_busy)
              const LoadingState(label: 'Memuat penugasan hari ini')
            else if (_error != null)
              _errorBox()
            else ...[
              _shiftCard(),
              const SizedBox(height: 14),
              _statusCard(),
              const SizedBox(height: 14),
              _biometricConsentCard(),
              const SizedBox(height: 14),
              _quickMenuGrid(),
              const SizedBox(height: 14),
              _handoverAnnouncement(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _errorBox() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.errorTint,
          borderRadius: BorderRadius.circular(AppColors.radiusInput),
          border: Border.all(color: AppColors.errorBorder),
        ),
        child: Column(
          children: [
            Text(_error!, style: const TextStyle(color: AppColors.errorText)),
            const SizedBox(height: 8),
            FilledButton.tonal(
                onPressed: _load, child: const Text('Coba lagi')),
          ],
        ),
      );

  Widget _shiftCard() {
    final ScheduleEntry? shift = _todayShift;
    final String shiftTitle =
        shift != null ? '${shift.shiftName} (Aktif)' : 'Shift Pagi (Aktif)';
    final String shiftHours = shift != null
        ? '${shift.startTime} - ${shift.endTime} WIB'
        : '07:00 - 15:00 WIB';

    return AppCard(
      accent: AppColors.primary,
      padding: const EdgeInsets.all(16),
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
                  Text(
                    'Penugasan Hari Ini',
                    style:
                        AppText.labelMd.copyWith(color: AppColors.inkSecondary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    shiftTitle,
                    style: AppText.headlineMd.copyWith(color: AppColors.ink),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(AppColors.radiusFull),
                  border: Border.all(color: AppColors.primaryFixed),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      shiftHours,
                      style: AppText.labelMd.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(AppColors.radiusInput),
              border: Border.all(color: AppColors.surfaceVariant),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.meeting_room,
                        size: 20, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Ruang Rawat Inap Melati Lt. 3',
                            style: AppText.bodyMdMedium
                                .copyWith(color: AppColors.ink),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Kamar Rawat: Bed 301 - 308 (Isolasi & Perawatan)',
                            style: AppText.labelSm
                                .copyWith(color: AppColors.inkSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(height: 1, color: AppColors.border),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.schedule,
                            size: 16, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(
                          'Toleransi ${shift?.gracePeriodMin ?? 15} mnt',
                          style: AppText.labelMd.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.timer_outlined,
                            size: 14, color: AppColors.inkSecondary),
                        const SizedBox(width: 4),
                        Text(
                          'Ambang telat ${shift?.lateThresholdMin ?? 30} mnt',
                          style: AppText.labelSm
                              .copyWith(color: AppColors.inkSecondary),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusCard() {
    final AttendanceHistoryItem? row = _today;
    final String? checkInAt = row?.checkInAt;
    final String? checkOutAt = row?.checkOutAt;
    final bool hasIn = checkInAt != null;
    final bool hasOut = checkOutAt != null;

    final String inTime = hasIn ? _hhmm(checkInAt) : '--:--';
    final String outTime = hasOut ? _hhmm(checkOutAt) : '--:--';

    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.timer_outlined,
                      size: 20, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    'Status Presensi',
                    style: AppText.headlineSm.copyWith(color: AppColors.ink),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLowest,
                  borderRadius: BorderRadius.circular(AppColors.radiusFull),
                  border: Border.all(color: AppColors.primaryFixed),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      hasIn ? Icons.check_circle : Icons.schedule,
                      size: 14,
                      color: hasIn ? AppColors.primary : AppColors.outline,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      hasIn
                          ? (row?.checkInStatus == null
                              ? 'Hadir'
                              : checkInStatusLabel(row!.checkInStatus))
                          : 'Belum Absen',
                      style: AppText.labelMd.copyWith(
                        color:
                            hasIn ? AppColors.primary : AppColors.inkSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppColors.radiusInput),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Absen Masuk',
                            style: AppText.labelSm
                                .copyWith(color: AppColors.inkSecondary),
                          ),
                          const Icon(Icons.login,
                              size: 18, color: AppColors.primary),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            inTime,
                            style: AppText.headlineMd.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ],
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'WIB',
                            style: AppText.labelMd
                                .copyWith(color: AppColors.inkSecondary),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            hasIn ? Icons.task_alt : Icons.schedule,
                            size: 13,
                            color:
                                hasIn ? AppColors.primary : AppColors.outline,
                          ),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              hasIn
                                  ? 'Terverifikasi Wajah'
                                  : 'Belum ada presensi',
                              style: AppText.labelSm.copyWith(
                                color: hasIn
                                    ? AppColors.primary
                                    : AppColors.inkSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppColors.radiusInput),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Absen Pulang',
                            style: AppText.labelSm
                                .copyWith(color: AppColors.inkSecondary),
                          ),
                          const Icon(Icons.logout,
                              size: 18, color: AppColors.outline),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            outTime,
                            style: AppText.headlineMd.copyWith(
                              color: hasOut
                                  ? AppColors.primary
                                  : AppColors.outline,
                              fontWeight: FontWeight.w700,
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ],
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'WIB',
                            style: AppText.labelMd
                                .copyWith(color: AppColors.inkSecondary),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.schedule,
                              size: 13, color: AppColors.outline),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              hasOut
                                  ? 'Terverifikasi Pulang'
                                  : 'Belum Absen Pulang',
                              style: AppText.labelSm
                                  .copyWith(color: AppColors.inkSecondary),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(AppColors.radiusInput),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.masks_outlined,
                        size: 18, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      'APD & Protokol Masker',
                      style: AppText.labelSm
                          .copyWith(color: AppColors.inkSecondary),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Text(
                      'Lolos Pengecekan',
                      style: AppText.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.check, size: 16, color: AppColors.primary),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: AppColors.buttonHeight,
            child: FilledButton(
              onPressed: widget.onStartAttendance,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.face, size: 22),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      hasIn
                          ? 'Absen Pulang (Verifikasi Wajah)'
                          : 'Absen Masuk (Verifikasi Wajah)',
                      style: AppText.bodyLgMedium.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.sync_alt, size: 14, color: AppColors.tertiary),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    'Tekan untuk beralih atau validasi pembaruan Absen Pulang',
                    style:
                        AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _biometricConsentCard() => AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            const Icon(Icons.face_retouching_natural,
                color: AppColors.primary, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Biometrik Wajah Aktif',
                    style: AppText.bodyMdMedium.copyWith(color: AppColors.ink),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Presensi diverifikasi secara langsung dengan sensor kamera & AI.',
                    style:
                        AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                  ),
                ],
              ),
            ),
            Switch(
              value: widget.biometricConsent,
              activeColor: AppColors.primary,
              onChanged: _consentBusy ? null : _toggleBiometric,
            ),
          ],
        ),
      );

  Widget _quickMenuGrid() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 8),
            child: Text(
              'Menu Utama Karyawan',
              style: AppText.labelMd.copyWith(color: AppColors.inkSecondary),
            ),
          ),
          Row(
            children: [
              _gridItem(
                icon: Icons.history,
                label: 'Riwayat',
                color: AppColors.primaryContainer,
                bgColor: AppColors.tealBadgeBg,
                onTap: widget.onOpenHistory ?? widget.onOpenSchedule,
              ),
              const SizedBox(width: 8),
              _gridItem(
                icon: Icons.edit_document,
                label: 'Koreksi',
                color: AppColors.secondary,
                bgColor: AppColors.infoTint,
                onTap: widget.onOpenCorrections,
              ),
              const SizedBox(width: 8),
              _gridItem(
                icon: Icons.event_available,
                label: 'Izin/Cuti',
                color: AppColors.tertiary,
                bgColor: AppColors.surfaceHigh,
                onTap: widget.onOpenLeaves,
              ),
              const SizedBox(width: 8),
              _gridItem(
                icon: Icons.calendar_month,
                label: 'Jadwal',
                color: AppColors.primaryContainer,
                bgColor: AppColors.surfaceLow,
                onTap: widget.onOpenSchedule,
              ),
              if (widget.onOpenHandovers != null) ...<Widget>[
                const SizedBox(width: 8),
                _gridItem(
                  icon: Icons.swap_horiz,
                  label: 'Operan Jaga',
                  color: AppColors.secondary,
                  bgColor: AppColors.infoTint,
                  onTap: widget.onOpenHandovers!,
                ),
              ],
            ],
          ),
        ],
      );

  Widget _gridItem({
    required IconData icon,
    required String label,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) =>
      Expanded(
        child: Material(
          color: AppColors.surfaceLowest,
          borderRadius: BorderRadius.circular(AppColors.radiusCard),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppColors.radiusCard),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppColors.radiusCard),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: bgColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, color: color, size: 24),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    style: AppText.labelMd.copyWith(color: AppColors.ink),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _handoverAnnouncement() => AppCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceHigh,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(
                        Icons.assignment_turned_in,
                        size: 18,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Operan Jaga Bangsal Melati',
                      style:
                          AppText.bodyMdMedium.copyWith(color: AppColors.ink),
                    ),
                  ],
                ),
                Text(
                  '14:45 WIB',
                  style:
                      AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppColors.radiusInput),
                border: Border.all(color: AppColors.surfaceVariant),
              ),
              child: Text(
                'Pukul 14:45 WIB mohon berkumpul di Nurse Station 3 untuk serah terima laporan SBAR pasien bed 304 (Post-Op Apendiktomi) dan ronde dokter spesialis anak.',
                style: AppText.bodyMd
                    .copyWith(color: AppColors.inkSecondary, fontSize: 13),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.group, size: 16, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text(
                      'Penanggung Jawab: Ns. Hendra, S.Kep',
                      style: AppText.labelSm
                          .copyWith(color: AppColors.inkSecondary),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content:
                            Text('Membuka catatan operan shift bangsal...'),
                      ),
                    );
                  },
                  child: Text(
                    'Lihat Rekam Medis',
                    style: AppText.labelMd.copyWith(color: AppColors.primary),
                  ),
                ),
              ],
            ),
          ],
        ),
      );

  static String _avatarInitials(String name) {
    if (name.isEmpty || name == '—') return '—';
    final parts = name.trim().split(' ');
    if (parts.length == 1) {
      return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  static String _hhmm(String iso) {
    final DateTime? d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '--:--';
    return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }
}


class _Notif {
  const _Notif({
    required this.icon,
    required this.color,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String body;
}
