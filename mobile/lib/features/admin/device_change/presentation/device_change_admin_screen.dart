import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/device_change_admin_repository.dart';
import '../domain/device_change_admin_models.dart';

/// Antrean persetujuan penggantian perangkat karyawan.
///
/// Menampilkan perangkat lama vs baru, alasan pengajuan, dan aksi
/// setujui/tolak dengan catatan opsional.
class DeviceChangeAdminScreen extends StatefulWidget {
  const DeviceChangeAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<DeviceChangeAdminScreen> createState() =>
      _DeviceChangeAdminScreenState();
}

class _DeviceChangeAdminScreenState extends State<DeviceChangeAdminScreen> {
  late final DeviceChangeAdminRepository _repo = DeviceChangeAdminRepository(
    dio: widget.dio,
  );

  List<AdminDeviceChange>? _items;
  String? _error;
  bool _loading = true;
  String? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final List<AdminDeviceChange> items = await _repo.list(status: _status);
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
        title: Text(approve ? 'Setujui penggantian?' : 'Tolak penggantian?'),
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
            child: Text(approve ? 'Setujui' : 'Tolak'),
          ),
        ],
      ),
    );
    final String text = note.text.trim();
    note.dispose();
    if (ok != true) return null;
    return text;
  }

  Future<void> _review(AdminDeviceChange item, {required bool approve}) async {
    final String? note = await _askNote(approve: approve);
    if (note == null || !mounted) return;
    try {
      if (approve) {
        await _repo.approve(item.id, note: note);
      } else {
        await _repo.reject(item.id, note: note);
      }
      if (!mounted) return;
      showAdminSnack(
        context,
        approve ? 'Penggantian perangkat disetujui.' : 'Penggantian ditolak.',
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  Future<void> _openDetail(AdminDeviceChange item) async {
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
                  StatusPill(item.status, label: item.statusLabel),
                ],
              ),
              const SizedBox(height: 12),
              DetailRow('NIP', item.employeeNo),
              DetailRow('Alasan', item.reasonLabel),
              if (item.reasonNote != null)
                DetailRow('Catatan alasan', item.reasonNote!),
              DetailRow('Perangkat lama', item.oldDeviceLabel),
              DetailRow('Perangkat baru', item.newDeviceLabel),
              DetailRow('Diajukan', adminDateTime(item.requestedAt)),
              if (item.reviewedAt != null)
                DetailRow('Ditinjau', adminDateTime(item.reviewedAt)),
              if (item.reviewNote != null)
                DetailRow('Catatan peninjau', item.reviewNote!),
              if (item.pending) ...<Widget>[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => Navigator.of(ctx).pop('approve'),
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Setujui'),
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
      return const LoadingState(label: 'Memuat penggantian perangkat');
    }
    if (_error != null && _items == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AdminDeviceChange> items =
        _items ?? const <AdminDeviceChange>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          AdminFilterChips(
            values: const <String?>[
              null,
              'PENDING',
              'APPROVED',
              'REJECTED',
              'CANCELLED',
            ],
            selected: _status,
            labels: const <String, String>{
              'all': 'Semua',
              'PENDING': 'Menunggu',
              'APPROVED': 'Disetujui',
              'REJECTED': 'Ditolak',
              'CANCELLED': 'Dibatalkan',
            },
            onChanged: (String? v) {
              _status = v;
              _load();
            },
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 32),
              child: AdminEmpty(
                icon: Icons.phonelink_setup,
                title: 'Tidak ada penggantian perangkat',
                subtitle: 'Coba ubah filter status.',
              ),
            )
          else
            for (final AdminDeviceChange item in items) ...<Widget>[
              AdminTile(
                icon: Icons.phonelink_setup,
                title: '${item.employeeName} · ${item.employeeNo}',
                subtitle: '${item.reasonLabel} · '
                    '${adminShortDate(item.requestedAt)}\n'
                    'Baru: ${item.newDeviceLabel}',
                accent: item.pending ? AppColors.warning : null,
                trailing: StatusPill(item.status, label: item.statusLabel),
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
      title: 'Penggantian Perangkat',
      subtitle: 'Tinjau permintaan ganti perangkat',
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
