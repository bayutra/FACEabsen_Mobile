import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/attendance_review_repository.dart';
import '../domain/attendance_review_models.dart';

class AttendanceReviewScreen extends StatefulWidget {
  const AttendanceReviewScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<AttendanceReviewScreen> createState() => _AttendanceReviewScreenState();
}

class _AttendanceReviewScreenState extends State<AttendanceReviewScreen> {
  late final AttendanceReviewRepository _repo = AttendanceReviewRepository(
    dio: widget.dio,
  );

  List<AttendanceReviewItem>? _items;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final List<AttendanceReviewItem> items = await _repo.list();
      if (!mounted) return;
      setState(() {
        _items = items;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final String message = adminErrorText(e);
      setState(() {
        _error = message;
        _loading = false;
      });
      if (_items != null) showAdminSnack(context, message, error: true);
    }
  }

  Future<String?> _askNote({required bool approve}) async {
    final TextEditingController note = TextEditingController();
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: Text(approve ? 'Validasi presensi?' : 'Tolak presensi?'),
        content: TextField(
          controller: note,
          maxLength: 500,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Catatan (opsional)',
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            style: approve
                ? null
                : FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(approve ? 'Validasi' : 'Tolak'),
          ),
        ],
      ),
    );
    final String text = note.text.trim();
    note.dispose();
    if (ok != true) return null;
    return text;
  }

  Future<void> _review(
    AttendanceReviewItem item, {
    required bool approve,
  }) async {
    final String? note = await _askNote(approve: approve);
    if (note == null || !mounted) return;
    try {
      await _repo.review(item.id, approve: approve, note: note);
      if (!mounted) return;
      showAdminSnack(
        context,
        approve ? 'Presensi divalidasi.' : 'Presensi ditolak.',
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  Future<void> _openDetail(AttendanceReviewItem item) async {
    final String? action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (BuildContext ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(item.employeeName, style: AppText.headlineSm),
                  ),
                  StatusPill(
                    item.checkInStatus ?? '',
                    label: item.checkInLabel,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DetailRow('NIP', item.employeeNo),
              if (item.departmentName != null)
                DetailRow('Unit', item.departmentName!),
              DetailRow('Tanggal', adminShortDate(item.workDate)),
              DetailRow('Shift', item.shiftName ?? '—'),
              DetailRow('Jam shift', item.shiftWindow ?? '—'),
              DetailRow('Masuk', adminDateTime(item.checkInAt), isTime: true),
              DetailRow('Pulang', adminDateTime(item.checkOutAt), isTime: true),
              DetailRow(
                'Kategori risiko',
                '${item.riskLabel}'
                    '${item.riskScore != null ? ' (${item.riskScore})' : ''}',
              ),
              const SizedBox(height: 8),
              const InfoBanner(
                'Presensi sudah tercatat. Validasi di sini menandai hasil '
                'verifikasi biometrik sudah diperiksa atasan.',
                tone: InfoBannerTone.info,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => Navigator.of(ctx).pop('approve'),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Validasi'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error),
                  ),
                  onPressed: () => Navigator.of(ctx).pop('reject'),
                  icon: const Icon(Icons.cancel_outlined),
                  label: const Text('Tolak'),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (action == null || !mounted) return;
    await _review(item, approve: action == 'approve');
  }

  Widget _body() {
    if (_loading && _items == null) {
      return const LoadingState(label: 'Memuat antrean tinjauan');
    }
    if (_error != null && _items == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AttendanceReviewItem> items =
        _items ?? const <AttendanceReviewItem>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          const InfoBanner(
            'Daftar presensi yang perlu dikonfirmasi atasan. Presensi tetap '
            'tercatat; validasi hanya menutup tanda tinjauan.',
            tone: InfoBannerTone.info,
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: AdminEmpty(
                icon: Icons.verified_user_outlined,
                title: 'Tidak ada presensi menunggu tinjauan',
                subtitle: 'Semua presensi sudah tervalidasi otomatis.',
              ),
            )
          else
            for (final AttendanceReviewItem item in items) ...<Widget>[
              AdminTile(
                icon: Icons.fact_check_outlined,
                title: '${item.employeeName} · ${item.employeeNo}',
                subtitle: '${adminShortDate(item.workDate)} · '
                    '${item.shiftName ?? '—'}\n'
                    'Masuk ${item.checkInLabel} · ${item.riskLabel}'
                    '${item.riskScore != null ? ' (${item.riskScore})' : ''}',
                accent: AppColors.warning,
                trailing: StatusPill(
                  item.checkInStatus ?? '',
                  label: item.checkInLabel,
                ),
                onTap: () => _openDetail(item),
              ),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Tinjauan Presensi',
      subtitle: 'Validasi presensi yang ditandai sistem',
      actions: <Widget>[
        IconButton(
          tooltip: 'Muat ulang',
          onPressed: _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: _body(),
    );
  }
}
