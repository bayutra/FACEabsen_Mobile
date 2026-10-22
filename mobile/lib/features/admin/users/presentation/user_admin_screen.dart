import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/user_admin_repository.dart';
import '../domain/user_admin_models.dart';
import 'user_admin_form_screen.dart';



class UserAdminScreen extends StatefulWidget {
  const UserAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<UserAdminScreen> createState() => _UserAdminScreenState();
}

class _UserAdminScreenState extends State<UserAdminScreen> {
  late final UserAdminRepository _repo = UserAdminRepository(dio: widget.dio);

  AdminUserPage? _page;
  String? _error;
  bool _loading = true;
  String? _role;
  bool? _active;
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
      final AdminUserPage page = await _repo.list(
        search: _search,
        role: _role,
        isActive: _active,
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

  Future<void> _openForm() async {
    final bool? saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => UserAdminFormScreen(dio: widget.dio),
      ),
    );
    if (saved == true && mounted) {
      showAdminSnack(context, 'Pengguna ditambahkan.');
      await _load();
    }
  }

  Future<void> _editRoles(AdminUser u) async {
    final Set<String> selected = Set<String>.from(u.roles);
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => StatefulBuilder(
        builder: (
          BuildContext ctx,
          void Function(void Function()) setLocal,
        ) =>
            AlertDialog(
          title: const Text('Ubah peran'),
          content: Wrap(
            spacing: 8,
            children: <Widget>[
              for (final String r in kAdminRoles)
                FilterChip(
                  label: Text(r),
                  selected: selected.contains(r),
                  onSelected: (bool on) => setLocal(() {
                    if (on) {
                      selected.add(r);
                    } else if (selected.length > 1) {
                      selected.remove(r);
                    }
                  }),
                ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed:
                  selected.isEmpty ? null : () => Navigator.of(ctx).pop(true),
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    await _run(
      () => _repo.update(u.id, roles: selected.toList()),
      'Peran ${u.email} diperbarui.',
    );
  }

  Future<void> _toggleActive(AdminUser u) async {
    if (u.isActive) {
      final bool ok = await confirmAdminAction(
        context,
        title: 'Nonaktifkan ${u.email}?',
        message: 'Akun tidak bisa login lagi sampai diaktifkan kembali. '
            'Riwayat yang sudah tercatat tetap tersimpan.',
        confirmLabel: 'Nonaktifkan',
        destructive: true,
      );
      if (!ok || !mounted) return;
      await _run(
        () => _repo.update(u.id, isActive: false),
        '${u.email} dinonaktifkan.',
      );
    } else {
      await _run(
        () => _repo.update(u.id, isActive: true),
        '${u.email} diaktifkan.',
      );
    }
  }

  Future<void> _resetPassword(AdminUser u) async {
    final TextEditingController pass = TextEditingController();
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: const Text('Reset password'),
        content: TextField(
          controller: pass,
          obscureText: true,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Password baru',
            helperText: 'Minimal 8 karakter',
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed:
                pass.text.length >= 8 ? () => Navigator.of(ctx).pop(true) : null,
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    final String newPass = pass.text;
    pass.dispose();
    if (ok != true || !mounted) return;
    await _run(
      () => _repo.resetPassword(u.id, password: newPass),
      'Password ${u.email} direset.',
    );
  }

  Future<void> _openActions(AdminUser u) async {
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
                    child: Text(u.email, style: AppText.headlineSm),
                  ),
                  StatusPill(u.isActive ? 'ACTIVE' : 'INACTIVE'),
                ],
              ),
              const SizedBox(height: 12),
              DetailRow('Nama karyawan', u.employeeName ?? 'â€”'),
              DetailRow('NIP', u.employeeNo ?? 'â€”'),
              DetailRow('Unit', u.departmentName ?? 'â€”'),
              DetailRow('Status karyawan', u.employeeStatus ?? 'â€”'),
              DetailRow(
                'Percobaan gagal',
                u.failedLoginAttempts?.toString() ?? '0',
              ),
              DetailRow('Dibuat', adminDateTime(u.createdAt)),
              if (u.locked) ...<Widget>[
                const SizedBox(height: 8),
                const InfoBanner(
                  'Akun terkunci sementara karena berulang kali gagal login.',
                  tone: InfoBannerTone.warning,
                ),
              ],
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => Navigator.of(ctx).pop('roles'),
                icon: const Icon(Icons.manage_accounts_outlined),
                label: const Text('Ubah Peran'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(ctx).pop('toggle'),
                icon: Icon(u.isActive ? Icons.block : Icons.check_circle_outline),
                label: Text(u.isActive ? 'Nonaktifkan' : 'Aktifkan'),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () => Navigator.of(ctx).pop('reset'),
                icon: const Icon(Icons.lock_reset),
                label: const Text('Reset Password'),
              ),
            ],
          ),
        ),
      ),
    );

    if (!mounted || action == null) return;
    if (action == 'roles') {
      await _editRoles(u);
    } else if (action == 'toggle') {
      await _toggleActive(u);
    } else if (action == 'reset') {
      await _resetPassword(u);
    }
  }

  Widget _userTile(AdminUser u) {
    return AppCard(
      onTap: () => _openActions(u),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              u.isActive ? Icons.person : Icons.person_off_outlined,
              size: 18,
              color: u.isActive ? AppColors.primary : AppColors.inkSecondary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  u.email,
                  style: AppText.bodyMdMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  u.employeeName ?? 'Tanpa data karyawan',
                  style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: <Widget>[
                    for (final String r in u.roles)
                      AppPill(
                        r,
                        AppColors.tealBadgeBg,
                        AppColors.tealBadgeText,
                        border: AppColors.tealBadgeBorder,
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          StatusPill(u.isActive ? 'ACTIVE' : 'INACTIVE'),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading && _page == null) {
      return const LoadingState(label: 'Memuat pengguna');
    }
    if (_error != null && _page == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AdminUser> items = _page?.items ?? const <AdminUser>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          AdminSearchField(
            hint: 'Cari email / nama / NIP',
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
              'EMPLOYEE',
              'SUPERVISOR',
              'ADMIN',
              'SUPER_ADMIN',
            ],
            selected: _role,
            labels: const <String, String>{'all': 'Semua peran'},
            onChanged: (String? v) {
              _role = v;
              _pageNo = 1;
              _load();
            },
          ),
          const SizedBox(height: 4),
          AdminFilterChips(
            values: const <String?>[null, 'true', 'false'],
            selected: _active == null
                ? null
                : (_active! ? 'true' : 'false'),
            labels: const <String, String>{
              'all': 'Semua status',
              'true': 'Aktif',
              'false': 'Nonaktif',
            },
            onChanged: (String? v) {
              _active = v == null ? null : v == 'true';
              _pageNo = 1;
              _load();
            },
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 32),
              child: AdminEmpty(
                icon: Icons.group_outlined,
                title: 'Tidak ada pengguna',
                subtitle: 'Coba ubah filter atau kata kunci.',
              ),
            )
          else
            for (final AdminUser u in items) ...<Widget>[
              _userTile(u),
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
      title: 'Pengguna',
      subtitle: '${_page?.totalItems ?? 0} akun terdaftar',
      actions: <Widget>[
        IconButton(
          tooltip: 'Muat ulang',
          onPressed: _load,
          icon: const Icon(Icons.refresh),
        ),
        IconButton(
          tooltip: 'Pengguna baru',
          onPressed: _openForm,
          icon: const Icon(Icons.person_add_alt),
        ),
      ],
      child: _body(),
    );
  }
}
