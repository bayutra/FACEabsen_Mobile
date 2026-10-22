import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../data/device_admin_repository.dart';
import '../domain/device_admin_models.dart';
import '../../presentation/admin_widgets.dart';

class DeviceAdminScreen extends StatefulWidget {
  const DeviceAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<DeviceAdminScreen> createState() => _DeviceAdminScreenState();
}

class _DeviceAdminScreenState extends State<DeviceAdminScreen> {
  late final DeviceAdminRepository _repo =
      DeviceAdminRepository(dio: widget.dio);

  AdminDevicePage? _page;
  String? _error;
  bool _loading = true;
  String? _status;
  String _search = '';
  int _pageNo = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final AdminDevicePage page = await _repo.list(
        status: _status,
        search: _search,
        page: _pageNo,
      );
      if (!mounted) return;
      setState(() {
        _page = page;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = adminErrorText(e);
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    try {
      await action();
      if (!mounted) return;
      showAdminSnack(context, success);
      await _load();
    } catch (e) {
      if (!mounted) return;
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  Future<void> _openDetail(AdminDevice d) async {
    final String? action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (BuildContext ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(d.deviceName ?? d.platform,
                        style: AppText.headlineSm),
                  ),
                  StatusPill(d.status),
                ],
              ),
              const SizedBox(height: 12),
              DetailRow('Karyawan', '${d.employeeName} (${d.employeeNo})'),
              DetailRow('Platform', d.platform),
              DetailRow('Versi app', d.appVersion ?? '—'),
              DetailRow('Terdaftar', adminDateTime(d.registeredAt)),
              DetailRow('Terakhir aktif', adminDateTime(d.lastSeenAt)),
              if (d.revokeReason != null)
                DetailRow('Alasan cabut', d.revokeReason!),
              const SizedBox(height: 16),
              if (d.pending)
                FilledButton.icon(
                  onPressed: () => Navigator.of(ctx).pop('activate'),
                  icon: const Icon(Icons.verified_user_outlined),
                  label: const Text('Aktifkan Perangkat'),
                ),
              if (d.status == 'ACTIVE') ...<Widget>[
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(ctx).pop('revoke'),
                  icon: const Icon(Icons.block),
                  label: const Text('Cabut Akses'),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => Navigator.of(ctx).pop('lost'),
                  icon: const Icon(Icons.report_gmailerrorred_outlined),
                  label: const Text('Tandai Hilang'),
                ),
              ],
            ],
          ),
        ),
      ),
    );

    if (action == null || !mounted) return;

    if (action == 'activate') {
      final bool ok = await confirmAdminAction(
        context,
        title: 'Aktifkan perangkat?',
        message: 'Perangkat aktif lain milik ${d.employeeName} akan otomatis '
            'dicabut. Karyawan langsung bisa presensi dari perangkat ini.',
        confirmLabel: 'Aktifkan',
      );
      if (ok) {
        await _run(() => _repo.activate(d.id), 'Perangkat diaktifkan.');
      }
    } else if (action == 'revoke') {
      final TextEditingController reason = TextEditingController();
      final bool? ok = await showDialog<bool>(
        context: context,
        builder: (BuildContext ctx) => AlertDialog(
          title: const Text('Cabut akses perangkat'),
          content: TextField(
            controller: reason,
            maxLength: 200,
            decoration: const InputDecoration(labelText: 'Alasan (opsional)'),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Batal'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.error),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Cabut'),
            ),
          ],
        ),
      );
      final String note = reason.text.trim();
      reason.dispose();
      if (ok == true) {
        await _run(() => _repo.revoke(d.id, reason: note), 'Akses dicabut.');
      }
    } else if (action == 'lost') {
      final bool ok = await confirmAdminAction(
        context,
        title: 'Tandai perangkat hilang?',
        message:
            'Perangkat tidak bisa dipakai presensi sampai diaktifkan ulang.',
        confirmLabel: 'Tandai Hilang',
        destructive: true,
      );
      if (ok) {
        await _run(() => _repo.markLost(d.id), 'Perangkat ditandai hilang.');
      }
    }
  }

  Widget _body() {
    if (_loading && _page == null) {
      return const LoadingState(label: 'Memuat perangkat');
    }
    if (_error != null && _page == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AdminDevice> items = _page?.items ?? const <AdminDevice>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          AdminSearchField(
            hint: 'Cari nama karyawan / perangkat',
            onSubmitted: (String v) {
              _search = v;
              _pageNo = 1;
              _load();
            },
          ),
          const SizedBox(height: 8),
          AdminFilterChips(
            values: const <String?>[
              null,
              'PENDING',
              'ACTIVE',
              'REVOKED',
              'LOST'
            ],
            selected: _status,
            labels: const <String, String>{
              'all': 'Semua',
              'PENDING': 'Menunggu',
              'ACTIVE': 'Aktif',
              'REVOKED': 'Dicabut',
              'LOST': 'Hilang',
            },
            onChanged: (String? v) {
              _status = v;
              _pageNo = 1;
              _load();
            },
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 32),
              child: AdminEmpty(
                icon: Icons.devices_other,
                title: 'Tidak ada perangkat',
                subtitle: 'Coba ubah filter atau kata kunci.',
              ),
            )
          else
            for (final AdminDevice d in items) ...<Widget>[
              AdminTile(
                icon: d.platform == 'IOS'
                    ? Icons.phone_iphone
                    : Icons.phone_android,
                title: d.deviceName ?? d.platform,
                subtitle: '${d.employeeName} (${d.employeeNo}) · '
                    '${adminShortDate(d.registeredAt)}',
                accent: d.pending ? AppColors.warning : null,
                trailing: StatusPill(d.status),
                onTap: () => _openDetail(d),
              ),
              const SizedBox(height: 8),
            ],
          AdminPager(
            page: _page?.page ?? 1,
            totalPages: _page?.totalPages ?? 1,
            onChanged: (int p) {
              _pageNo = p;
              _load();
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Perangkat',
      subtitle: 'Aktivasi & pencabutan akses',
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
