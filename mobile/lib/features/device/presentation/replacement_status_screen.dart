import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../data/device_repository.dart';
import '../domain/device_models.dart';
import 'helpdesk_sheet.dart';
import 'replacement_screen.dart' show replacementReasons;

/// Replacement status tracking (mockup
/// `status_penggantian_perangkat_menunggu_admin`).
///
/// Renders ONLY real data from [request]: the short real request id, real
/// timestamps when the payload carries them, a 4-step timeline derived from
/// the REAL status, old→new rows from real embedded device fields, and the
/// real reason value. Anything unavailable is omitted — never invented.
class ReplacementStatusScreen extends StatefulWidget {
  const ReplacementStatusScreen({
    super.key,
    required this.request,
    required this.devices,
  });

  final ChangeRequest request;
  final DeviceRepository devices;

  @override
  State<ReplacementStatusScreen> createState() => _ReplacementStatusScreenState();
}

class _ReplacementStatusScreenState extends State<ReplacementStatusScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _cancel() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.devices.cancelChangeRequest(widget.request.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Gagal membatalkan. Coba lagi.';
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ChangeRequest r = widget.request;
    final bool pending = r.status == ChangeRequestStatus.pending;
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Status Pengajuan Ganti HP'),
            Text('RS Absen • Keamanan Akun',
                style: TextStyle(fontSize: 11, color: AppColors.inkSecondary)),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _headerCard(r),
            const SizedBox(height: 12),
            _timelineCard(r),
            const SizedBox(height: 12),
            _detailCard(r),
            const SizedBox(height: 12),
            _helpdeskCard(context),
            const SizedBox(height: 16),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InfoBanner(
                  _error!,
                  title: 'Gagal membatalkan',
                  tone: InfoBannerTone.error,
                ),
              ),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
              icon: const Icon(Icons.home),
              label: const Text('Kembali ke Beranda'),
            ),
            const SizedBox(height: 8),
            if (pending)
              OutlinedButton.icon(
                onPressed: _busy ? null : _cancel,
                icon: const Icon(Icons.cancel_outlined),
                label: Text(_busy ? 'Membatalkan…' : 'Batalkan Permohonan Penggantian'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.errorText,
                  side: const BorderSide(color: AppColors.error),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _headerCard(ChangeRequest r) {
    final String headline = switch (r.status) {
      ChangeRequestStatus.pending => 'Menunggu Persetujuan Admin IT',
      ChangeRequestStatus.approved => 'Pengajuan Disetujui Admin IT',
      ChangeRequestStatus.rejected => 'Pengajuan Ditolak Admin IT',
      ChangeRequestStatus.cancelled => 'Pengajuan Dibatalkan',
      ChangeRequestStatus.unknown => 'Status Pengajuan Tidak Diketahui',
    };
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: _requestPill(r.status)),
              const SizedBox(width: 8),
              Text(
                'Tiket ${shortTicketId(r.id)}',
                style: AppText.bodyMdMedium,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(headline, style: AppText.headlineSm.copyWith(color: AppColors.ink)),
          if (r.requestedAt != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.schedule, size: 16, color: AppColors.inkSecondary),
                const SizedBox(width: 6),
                Text(
                  'Diajukan: ${formatIdDateTime(r.requestedAt!)}',
                  style: AppText.labelSm.copyWith(
                    color: AppColors.inkSecondary,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _timelineCard(ChangeRequest r) {
    final String? reviewed = r.reviewedAt != null ? formatIdDateTime(r.reviewedAt!) : null;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Alur Persetujuan & Binding',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          _step(
            done: true,
            title: 'Pengajuan Terkirim',
            subtitle: r.requestedAt != null
                ? formatIdDateTime(r.requestedAt!)
                : 'Terkirim',
            state: 'SELESAI',
          ),
          _step(
            done: true,
            title: 'Verifikasi Identitas',
            subtitle: 'Password SIMRS terverifikasi saat pengajuan',
            state: 'SELESAI',
          ),
          _step(
            done: r.status == ChangeRequestStatus.approved,
            failed: r.status == ChangeRequestStatus.rejected,
            cancelled: r.status == ChangeRequestStatus.cancelled,
            inProgress: r.status == ChangeRequestStatus.pending,
            title: 'Review Admin IT',
            subtitle: switch (r.status) {
              ChangeRequestStatus.pending => 'Menunggu antrean review admin IT',
              ChangeRequestStatus.approved => [
                  if (reviewed != null) reviewed,
                  if (r.reviewNote?.isNotEmpty == true) r.reviewNote!,
                ].join(' • ').ifEmpty('Disetujui'),
              ChangeRequestStatus.rejected => [
                  if (reviewed != null) reviewed,
                  if (r.reviewNote?.isNotEmpty == true) r.reviewNote!,
                ].join(' • ').ifEmpty('Ditolak'),
              ChangeRequestStatus.cancelled => 'Dibatalkan oleh pemohon',
              ChangeRequestStatus.unknown => 'Status tidak diketahui',
            },
            state: switch (r.status) {
              ChangeRequestStatus.pending => 'DIPROSES',
              ChangeRequestStatus.approved => 'DISETUJUI',
              ChangeRequestStatus.rejected => 'DITOLAK',
              ChangeRequestStatus.cancelled => 'DIBATALKAN',
              ChangeRequestStatus.unknown => 'MENUNGGU',
            },
          ),
          _step(
            done: r.status == ChangeRequestStatus.approved,
            cancelled: r.status == ChangeRequestStatus.rejected ||
                r.status == ChangeRequestStatus.cancelled,
            title: 'Aktivasi Perangkat Baru',
            subtitle: r.status == ChangeRequestStatus.approved
                ? 'Perangkat baru aktif, perangkat lama dicabut'
                : 'Menunggu aktivasi',
            state: r.status == ChangeRequestStatus.approved ? 'SELESAI' : 'MENUNGGU',
            last: true,
          ),
        ],
      ),
    );
  }

  Widget _step({
    required String title,
    required String subtitle,
    required String state,
    bool done = false,
    bool failed = false,
    bool cancelled = false,
    bool inProgress = false,
    bool last = false,
  }) {
    final Color dot = done
        ? AppColors.success
        : failed
            ? AppColors.error
            : inProgress
                ? AppColors.warning
                : AppColors.inkDisabled;
    final (Color bg, Color fg) = done
        ? (AppColors.successTint, AppColors.successText)
        : failed
            ? (AppColors.errorTint, AppColors.errorText)
            : (AppColors.canvas, AppColors.inkSecondary);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: bg,
                border: Border.all(color: dot, width: 2),
              ),
              child: done
                  ? Icon(Icons.check, size: 13, color: fg)
                  : null,
            ),
            if (!last) Container(width: 2, height: 28, color: AppColors.border),
          ],
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(title,
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w500)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: cancelled ? AppColors.surfaceLow : bg,
                        borderRadius: BorderRadius.circular(
                            AppColors.radiusFull),
                        border: Border.all(
                          color: cancelled
                              ? AppColors.border
                              : dot,
                        ),
                      ),
                      child: Text(state,
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: cancelled ? AppColors.inkSecondary : fg)),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.inkSecondary)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _detailCard(ChangeRequest r) {
    final (String label, String? note) = _splitReason(r.reason);
    final BoundDevice? oldD = r.oldDevice;
    final BoundDevice? newD = r.newDevice;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Detail Pergantian Perangkat',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          if (oldD != null || newD != null) ...[
            Row(
              children: [
                if (oldD != null)
                  Expanded(child: _deviceBox('Perangkat Lama', oldD, false)),
                if (oldD != null && newD != null) const SizedBox(width: 8),
                if (newD != null)
                  Expanded(child: _deviceBox('Perangkat Baru', newD, true)),
              ],
            ),
            const SizedBox(height: 12),
          ],
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(AppColors.radiusInput),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Alasan Penggantian:',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(label, style: const TextStyle(fontSize: 13)),
                if (note?.isNotEmpty == true) ...[
                  const SizedBox(height: 2),
                  Text(note!,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.inkSecondary)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  (String, String?) _splitReason(String reason) {
    final int idx = reason.indexOf(':');
    if (idx < 0) {
      return (replacementReasons[reason.trim()] ?? reason, null);
    }
    final String code = reason.substring(0, idx).trim();
    final String note = reason.substring(idx + 1).trim();
    return (replacementReasons[code] ?? code, note.isEmpty ? null : note);
  }

  Widget _deviceBox(String caption, BoundDevice d, bool isNew) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isNew ? AppColors.tealBadgeBg.withOpacity(0.5) : AppColors.errorTint.withOpacity(0.4),
          borderRadius: BorderRadius.circular(AppColors.radiusInput),
          border: Border.all(
              color: isNew ? AppColors.tealBadgeBorder : AppColors.errorBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(caption,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isNew ? AppColors.tealBadgeText : AppColors.errorText)),
            const SizedBox(height: 4),
            Text(
              d.deviceName?.isNotEmpty == true
                  ? d.deviceName!
                  : shortDeviceId(
                      d.installationId.isNotEmpty ? d.installationId : d.id),
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            if (d.platform.isNotEmpty)
              Text(d.platform,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.inkSecondary)),
          ],
        ),
      );

  Widget _helpdeskCard(BuildContext context) => AppCard(
        child: Row(
          children: [
            const Icon(Icons.headset_mic, color: AppColors.secondary),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Butuh persetujuan segera untuk shift?',
                      style:
                          TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  Text('Hubungi Helpdesk SIMRS Ext. 104.',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.inkSecondary)),
                ],
              ),
            ),
            OutlinedButton(
              onPressed: () => showHelpdeskSheet(context),
              child: const Text('Hubungi'),
            ),
          ],
        ),
      );
}

extension _IfEmpty on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

Widget _requestPill(ChangeRequestStatus s) {
  final (Color bg, Color fg, Color border) = switch (s) {
    ChangeRequestStatus.approved => (
        AppColors.successTint,
        AppColors.successText,
        AppColors.successBorder,
      ),
    ChangeRequestStatus.rejected => (
        AppColors.errorTint,
        AppColors.errorText,
        AppColors.errorBorder,
      ),
    _ => (
        AppColors.warningTint,
        AppColors.warningText,
        AppColors.warningBorder,
      ),
  };
  return AppPill(changeRequestStatusLabel(s), bg, fg, border: border);
}
