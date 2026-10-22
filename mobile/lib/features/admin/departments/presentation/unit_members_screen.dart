import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../employees/data/employee_admin_repository.dart';
import '../../employees/domain/employee_admin_models.dart';
import '../../presentation/admin_widgets.dart';





class UnitMembersScreen extends StatefulWidget {
  const UnitMembersScreen({
    super.key,
    required this.dio,
    required this.departmentId,
    required this.departmentName,
  });

  final Dio dio;
  final String departmentId;
  final String departmentName;

  @override
  State<UnitMembersScreen> createState() => _UnitMembersScreenState();
}

class _UnitMembersScreenState extends State<UnitMembersScreen> {
  late final EmployeeAdminRepository _repo = EmployeeAdminRepository(
    dio: widget.dio,
  );

  List<AdminEmployee>? _items;
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
      final AdminEmployeePage page = await _repo.list(
        departmentId: widget.departmentId,
        pageSize: 100,
      );
      if (!mounted) return;
      setState(() {
        _items = page.items;
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

  void _openDetail(AdminEmployee e) {
    showModalBottomSheet<void>(
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
              DetailRow('Jabatan', e.position ?? '—'),
              DetailRow('Unit', e.departmentName ?? widget.departmentName),
              DetailRow('Atasan', e.supervisorName ?? '—'),
              DetailRow('Email', e.email),
              DetailRow('Telepon', e.phone ?? '—'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading && _items == null) {
      return const LoadingState(label: 'Memuat anggota unit');
    }
    if (_error != null && _items == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AdminEmployee> items = _items ?? const <AdminEmployee>[];
    final int active = items.where((AdminEmployee e) => e.active).length;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          InfoBanner(
            '${items.length} karyawan terdaftar di ${widget.departmentName} '
            '($active aktif). Ubah data anggota lewat menu Karyawan.',
            tone: InfoBannerTone.info,
            title: 'Kelompok ${widget.departmentName}',
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const AdminEmpty(
              icon: Icons.group_off_outlined,
              title: 'Belum ada anggota',
              subtitle: 'Tetapkan unit karyawan dari menu Karyawan.',
            )
          else
            for (final AdminEmployee e in items) ...<Widget>[
              AdminTile(
                icon: Icons.person_outline,
                title: '${e.name} · ${e.employeeNo}',
                subtitle: '${e.position ?? 'Tanpa jabatan'}'
                    '${e.supervisorName == null ? '' : ' · Atasan: ${e.supervisorName}'}',
                trailing: StatusPill(e.status),
                onTap: () => _openDetail(e),
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
      title: widget.departmentName,
      subtitle: 'Anggota unit',
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
