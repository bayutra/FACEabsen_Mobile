import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/employee_admin_repository.dart';
import '../domain/employee_admin_models.dart';
import 'employee_admin_form_screen.dart';

/// Daftar & pengelolaan data karyawan (ADMIN).
class EmployeeAdminScreen extends StatefulWidget {
  const EmployeeAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<EmployeeAdminScreen> createState() => _EmployeeAdminScreenState();
}

class _EmployeeAdminScreenState extends State<EmployeeAdminScreen> {
  late final EmployeeAdminRepository _repo = EmployeeAdminRepository(dio: widget.dio);

  AdminEmployeePage? _page;
  String? _error;
  bool _loading = true;
  String? _status;
  String _search = '';
  int _pageNo = 1;

  List<AdminDepartment> _units = const <AdminDepartment>[];
  String _departmentId = '';

  @override
  void initState() {
    super.initState();
    _load();
    _loadUnits();
  }

  Future<void> _loadUnits() async {
    try {
      final List<AdminDepartment> units = await _repo.departments();
      if (mounted) setState(() => _units = units);
    } catch (_) {
      // Filter unit bersifat opsional; daftar karyawan tetap bisa dipakai.
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final AdminEmployeePage page = await _repo.list(
        search: _search,
        status: _status,
        departmentId: _departmentId.isEmpty ? null : _departmentId,
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

  Future<void> _openForm([AdminEmployee? employee]) async {
    final bool? saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => EmployeeAdminFormScreen(dio: widget.dio, employee: employee),
      ),
    );
    if (saved == true && mounted) {
      showAdminSnack(context, employee == null ? 'Karyawan ditambahkan.' : 'Data diperbarui.');
      await _load();
    }
  }

  Future<void> _deactivate(AdminEmployee e) async {
    final bool ok = await confirmAdminAction(
      context,
      title: 'Nonaktifkan ${e.name}?',
      message: 'Akun tidak bisa login lagi, tetapi seluruh riwayat presensi '
          'tetap tersimpan. Tindakan ini tidak menghapus data.',
      confirmLabel: 'Nonaktifkan',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      await _repo.deactivate(e.id);
      if (!mounted) return;
      showAdminSnack(context, '${e.name} dinonaktifkan.');
      await _load();
    } catch (err) {
      if (!mounted) return;
      showAdminSnack(context, adminErrorText(err), error: true);
    }
  }

  Future<void> _openDetail(AdminEmployee e) async {
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
                  Expanded(child: Text(e.name, style: AppText.headlineSm)),
                  StatusPill(e.status),
                ],
              ),
              const SizedBox(height: 12),
              DetailRow('NIP', e.employeeNo),
              DetailRow('Email', e.email),
              DetailRow('Telepon', e.phone ?? 'â€”'),
              DetailRow('Jabatan', e.position ?? 'â€”'),
              DetailRow('Unit', e.departmentName ?? 'â€”'),
              DetailRow('Atasan', e.supervisorName ?? 'â€”'),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => Navigator.of(ctx).pop('edit'),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Ubah Data'),
              ),
              if (e.active) ...<Widget>[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(ctx).pop('deactivate'),
                  icon: const Icon(Icons.person_off_outlined),
                  label: const Text('Nonaktifkan'),
                ),
              ],
            ],
          ),
        ),
      ),
    );

    if (!mounted || action == null) return;
    if (action == 'edit') {
      await _openForm(e);
    } else if (action == 'deactivate') {
      await _deactivate(e);
    }
  }

  Widget _body() {
    if (_loading && _page == null) {
      return const LoadingState(label: 'Memuat karyawan');
    }
    if (_error != null && _page == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AdminEmployee> items = _page?.items ?? const <AdminEmployee>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          AdminSearchField(
            hint: 'Cari nama / NIP / email',
            onSubmitted: (String v) {
              _search = v;
              _pageNo = 1;
              _load();
            },
          ),
          const SizedBox(height: 8),
          if (_units.isNotEmpty)
            DropdownButtonFormField<String>(
              value: _departmentId,
              decoration: const InputDecoration(
                labelText: 'Kelompok Unit',
                prefixIcon: Icon(Icons.apartment_outlined, size: 20),
              ),
              items: <DropdownMenuItem<String>>[
                const DropdownMenuItem<String>(
                  value: '',
                  child: Text('Semua Unit'),
                ),
                for (final AdminDepartment unit in _units)
                  DropdownMenuItem<String>(
                    value: unit.id,
                    child: Text(unit.name),
                  ),
              ],
              onChanged: (String? v) {
                _departmentId = v ?? '';
                _pageNo = 1;
                _load();
              },
            ),
          const SizedBox(height: 8),
          AdminFilterChips(
            values: const <String?>[null, 'ACTIVE', 'INACTIVE'],
            selected: _status,
            labels: const <String, String>{
              'all': 'Semua',
              'ACTIVE': 'Aktif',
              'INACTIVE': 'Nonaktif',
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
                icon: Icons.badge_outlined,
                title: 'Belum ada karyawan',
                subtitle: 'Tambahkan karyawan lewat tombol + di bawah.',
              ),
            )
          else
            for (final AdminEmployee e in items) ...<Widget>[
              AdminTile(
                icon: Icons.badge_outlined,
                title: '${e.name} Â· ${e.employeeNo}',
                subtitle: '${e.departmentName ?? 'Tanpa Unit'}'
                    '${e.position == null ? '' : ' Â· ${e.position}'}',
                trailing: StatusPill(e.status),
                onTap: () => _openDetail(e),
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
      title: 'Karyawan',
      subtitle: '${_page?.totalItems ?? 0} karyawan terdaftar',
      actions: <Widget>[
        IconButton(
          tooltip: 'Tambah karyawan',
          onPressed: () => _openForm(),
          icon: const Icon(Icons.person_add_alt),
        ),
      ],
      child: _body(),
    );
  }
}
