import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../correction/data/correction_repository.dart';
import '../../correction/domain/correction_models.dart';
import '../../handovers/data/handover_repository.dart';
import '../../handovers/domain/handover_models.dart';
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
    this.dio,
    this.corrections,
    this.roles = const <String>[],
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

  final Dio? dio;
  final CorrectionRepository? corrections;
  final List<String> roles;

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

  // Kepala Ruangan / Supervisor: antrean persetujuan + operan aktif.
  List<CorrectionItem> _pendingCorrections = const [];
  List<ReviewItem> _pendingReviews = const [];
  List<Handover> _activeHandovers = const [];
  bool _isSupervisor = false;

  @override
  void initState() {
    super.initState();
    _isSupervisor = widget.roles.contains('SUPERVISOR');
    _load();
  }

  DateTime get _now => DateTime.now();

  String _roleLabel() {
    if (widget.roles.contains('SUPERVISOR')) return 'Kepala Ruangan';
    if (widget.roles.contains('ADMIN')) return 'Admin';
    if (widget.roles.contains('SUPER_ADMIN')) return 'Super Admin';
    return 'Karyawan';
  }

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

      final futures = <Future<Object?>>[
        widget.attendance.myHistory(from: todayKey, to: todayKey),
        widget.schedules.mySchedule(
          from: monday,
          to: monday.add(const Duration(days: 6)),
        ),
        widget.attendance.outbox().count(),
        if (widget.dio != null)
          HandoverRepository(dio: widget.dio!).list(status: 'PENDING'),
        if (_isSupervisor && widget.corrections != null)
          widget.corrections!.listQueue(status: 'PENDING'),
        if (_isSupervisor) widget.attendance.listReviewQueue(),
      ];
      final results = await Future.wait(futures);

      final todayPage = results[0] as AttendanceHistoryPage;
      final int outboxCount = results[2] as int;
      int idx = 3;
      List<Handover> handovers = const [];
      if (widget.dio != null) {
        handovers = results[idx] as List<Handover>;
        idx++;
      }
      List<CorrectionItem> corrections = const [];
      if (_isSupervisor && widget.corrections != null) {
        corrections = results[idx] as List<CorrectionItem>;
        idx++;
      }
      List<ReviewItem> reviews = const [];
      if (_isSupervisor) {
        reviews = results[idx] as List<ReviewItem>;
        idx++;
      }
      if (!mounted) return;
      setState(() {
        _today = todayPage.items.isEmpty ? null : todayPage.items.first;
        _week = results[1] as List<ScheduleEntry>;
        _outboxCount = outboxCount;
        _activeHandovers = handovers;
        _pendingCorrections = corrections;
        _pendingReviews = reviews;
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

  int get _pendingApprovals =>
      _pendingCorrections.length + _pendingReviews.length;

  Future<void> _decideCorrection(String id, bool approve) async {
    try {
      if (approve) {
        await widget.corrections?.approve(id);
      } else {
        await widget.corrections?.reject(id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  approve ? 'Koreksi disetujui.' : 'Koreksi ditolak.')),
        );
        await _load();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Gagal memproses koreksi.')),
        );
      }
    }
  }

  Future<void> _decideReview(String id, bool approve) async {
    try {
      await widget.attendance.review(
        id,
        decision: approve ? 'APPROVE' : 'REJECT',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  approve ? 'Presensi divalidasi.' : 'Presensi ditandai tidak sah.')),
        );
        await _load();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Gagal memproses tinjauan.')),
        );
      }
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
        if (_isSupervisor && _pendingApprovals > 0) {
          items.add(Notif(
            icon: Icons.pending_actions,
            color: AppColors.warningText,
            title: 'Permintaan persetujuan',
            body:
                '$_pendingApprovals pengajuan menunggu ditinjau (koreksi/review absensi anggota unit Anda).',
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
                        Text(
                          _roleLabel(),
                          style: AppText.labelSm.copyWith(
                            color: AppColors.inkSecondary,
                            fontWeight: FontWeight.w600,
                          ),
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
                        if (_outboxCount + widget.pendingDevices + _pendingApprovals > 0)
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
                                '${_outboxCount + widget.pendingDevices + _pendingApprovals}',
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
              if (_isSupervisor && _pendingApprovals > 0) ...[
                _ApprovalBar(
                  corrections: _pendingCorrections,
                  reviews: _pendingReviews,
                  onCorrection: _decideCorrection,
                  onReview: _decideReview,
                ),
                const SizedBox(height: 14),
              ],
              quickMenuGrid(
                onOpenCorrections: widget.onOpenCorrections,
                onOpenLeaves: widget.onOpenLeaves,
                onOpenSchedule: widget.onOpenSchedule,
                onOpenHistory: widget.onOpenHistory,
                onOpenHandovers: widget.onOpenHandovers,
              ),
              const SizedBox(height: 14),
              handoverAnnouncement(
                context,
                items: _activeHandovers,
                onOpen: widget.onOpenHandovers,
              ),
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

/// Bar persetujuan untuk Kepala Ruangan: koreksi + review absensi
/// anggota unitnya, dengan tombol Setujui/Tolak langsung.
class _ApprovalBar extends StatelessWidget {
  const _ApprovalBar({
    required this.corrections,
    required this.reviews,
    required this.onCorrection,
    required this.onReview,
  });

  final List<CorrectionItem> corrections;
  final List<ReviewItem> reviews;
  final void Function(String id, bool approve) onCorrection;
  final void Function(String id, bool approve) onReview;

  @override
  Widget build(BuildContext context) {
    final int total = corrections.length + reviews.length;
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.pending_actions,
                  size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                'Permintaan Persetujuan (Kepala Ruangan)',
                style: AppText.bodyMdMedium.copyWith(
                  color: AppColors.ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Text(
                '$total menunggu',
                style: AppText.labelSm.copyWith(
                  color: AppColors.warningText,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final c in corrections)
            _Row(
              title: c.employeeName ?? 'Karyawan',
              subtitle: '${c.workDate ?? ''} · ${c.type} · ${c.reason}',
              onApprove: () => onCorrection(c.id, true),
              onReject: () => onCorrection(c.id, false),
            ),
          for (final r in reviews)
            _Row(
              title: r.employeeName ?? 'Karyawan',
              subtitle: 'Review absensi ${r.workDate}'
                  '${r.riskCategory != null ? ' · ${r.riskCategory}' : ''}',
              onApprove: () => onReview(r.id, true),
              onReject: () => onReview(r.id, false),
            ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.title,
    required this.subtitle,
    required this.onApprove,
    required this.onReject,
  });

  final String title;
  final String subtitle;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppText.labelMd.copyWith(
                    color: AppColors.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  subtitle,
                  style: AppText.labelSm.copyWith(
                    color: AppColors.inkSecondary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          TextButton(onPressed: onReject, child: const Text('Tolak')),
          FilledButton(onPressed: onApprove, child: const Text('Setujui')),
        ],
      ),
    );
  }
}
