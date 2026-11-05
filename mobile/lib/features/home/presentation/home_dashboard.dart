import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../schedule/data/schedule_repository.dart';
import '../../schedule/domain/shift_status.dart';
import 'home_sections.dart';

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

  void _showNotifications() {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext ctx) {
        final List<Notif> items = <Notif>[];
        if (_outboxCount > 0) {
          items.add(Notif(
            icon: Icons.cloud_off,
            color: AppColors.warningText,
            title: 'Presensi offline tertunda',
            body:
                '$_outboxCount presensi tersimpan di perangkat, akan dikirim saat online.',
          ));
        }
        if (widget.pendingDevices > 0) {
          items.add(Notif(
            icon: Icons.devices_other_outlined,
            color: AppColors.primary,
            title: 'Perangkat menunggu aktivasi',
            body: '${widget.pendingDevices} perangkat belum diaktifkan admin.',
          ));
        }
        if (items.isEmpty) {
          items.add(const Notif(
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
                ...items.map((Notif n) => Padding(
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
                                    style: AppText.bodyMd.copyWith(
                                        color: AppColors.inkSecondary)),
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
                          avatarInitials(widget.displayName),
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
                          greeting(),
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
                    const Icon(Icons.logout,
                        color: AppColors.warningText, size: 20),
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
                    const Icon(Icons.logout,
                        color: AppColors.warningText, size: 20),
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
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLowest,
                borderRadius: BorderRadius.circular(AppColors.radiusCard),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Status Hari Ini',
                            style: AppText.labelSm
                                .copyWith(color: AppColors.inkSecondary)),
                        const SizedBox(height: 4),
                        Text(
                          _today == null
                              ? 'Belum presensi'
                              : (_today!.checkOutAt == null
                                  ? 'Sudah check-in'
                                  : 'Sudah check-out'),
                          style: AppText.bodyLgMedium
                              .copyWith(color: AppColors.ink),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(AppColors.radiusFull),
                    ),
                    child: Text(
                      '${_week.length} shift minggu ini',
                      style: AppText.labelSm.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLowest,
                borderRadius: BorderRadius.circular(AppColors.radiusCard),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Status Hari Ini',
                            style: AppText.labelSm
                                .copyWith(color: AppColors.inkSecondary)),
                        const SizedBox(height: 4),
                        Text(
                          _today == null
                              ? 'Belum presensi'
                              : (_today!.checkOutAt == null
                                  ? 'Sudah check-in'
                                  : 'Sudah check-out'),
                          style: AppText.bodyLgMedium
                              .copyWith(color: AppColors.ink),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(AppColors.radiusFull),
                    ),
                    child: Text(
                      '${_week.length} shift minggu ini',
                      style: AppText.labelSm.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
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
              shiftCard(shift: _todayShift),
              const SizedBox(height: 14),
              statusCard(
                row: _today,
                onStartAttendance: widget.onStartAttendance,
              ),
              const SizedBox(height: 14),
              biometricConsentCard(
                biometricConsent: widget.biometricConsent,
                consentBusy: _consentBusy,
                onToggle: _toggleBiometric,
              ),
              const SizedBox(height: 14),
              quickMenuGrid(
                onOpenCorrections: widget.onOpenCorrections,
                onOpenLeaves: widget.onOpenLeaves,
                onOpenSchedule: widget.onOpenSchedule,
                onOpenHistory: widget.onOpenHistory,
                onOpenHandovers: widget.onOpenHandovers,
              ),
              const SizedBox(height: 14),
              handoverAnnouncement(context),
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
}
