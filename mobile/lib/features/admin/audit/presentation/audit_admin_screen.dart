import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/audit_admin_repository.dart';
import '../domain/audit_admin_models.dart';

class AuditAdminScreen extends StatefulWidget {
  const AuditAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<AuditAdminScreen> createState() => _AuditAdminScreenState();
}

class _AuditAdminScreenState extends State<AuditAdminScreen> {
  late final AuditAdminRepository _repo = AuditAdminRepository(dio: widget.dio);

  AdminAuditPage? _page;
  String? _error;
  bool _loading = true;
  String? _result;
  String _search = '';
  String? _action;
  DateTimeRange? _range;
  List<String>? _actions;
  int _pageNo = 1;

  @override
  void initState() {
    super.initState();
    _load();
    _loadActions();
  }

  Future<void> _loadActions() async {
    try {
      final List<String> list = await _repo.actions();
      if (!mounted) return;
      setState(() => _actions = list.isEmpty ? null : list);
    } catch (_) {
      if (mounted) setState(() => _actions = null);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final AdminAuditPage page = await _repo.list(
        action: _action,
        actorEmail: _search,
        result: _result,
        from: _range == null ? null : adminDate(_range!.start),
        to: _range == null ? null : adminDate(_range!.end),
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

  Future<void> _pickRange() async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDateRange: _range,
    );
    if (picked == null) return;
    setState(() => _range = picked);
    _pageNo = 1;
    await _load();
  }

  void _clearRange() {
    setState(() => _range = null);
    _pageNo = 1;
    _load();
  }

  Widget _resultPill(String result) {
    final (Color bg, Color fg, Color border) = switch (result) {
      'SUCCESS' => (
          AppColors.successTint,
          AppColors.successText,
          AppColors.successBorder,
        ),
      'FAILED' => (
          AppColors.errorTint,
          AppColors.errorText,
          AppColors.errorBorder,
        ),
      'DENIED' => (
          AppColors.roseTint,
          AppColors.roseText,
          AppColors.roseBorder,
        ),
      _ => (
          AppColors.infoTint,
          AppColors.info,
          AppColors.surfaceHighest,
        ),
    };
    return AppPill(result, bg, fg, border: border);
  }

  String _prettyMetadata(Map<String, dynamic>? meta) {
    if (meta == null || meta.isEmpty) return '—';
    return const JsonEncoder.withIndent('  ').convert(meta);
  }

  void _openDetail(AdminAuditLog log) {
    showModalBottomSheet<void>(
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
                    child: Text(log.action, style: AppText.headlineSm),
                  ),
                  _resultPill(log.result),
                ],
              ),
              const SizedBox(height: 12),
              DetailRow('Waktu', adminDateTime(log.timestamp)),
              DetailRow('Aktor', log.actorLabel),
              DetailRow('ID Aktor', log.actorId),
              DetailRow(
                'Target',
                log.targetType == null && log.targetId == null
                    ? '—'
                    : '${log.targetType ?? '—'} · ${log.targetId ?? '—'}',
              ),
              DetailRow('IP', log.ipAddress ?? '—'),
              DetailRow('Perangkat', log.deviceId ?? '—'),
              if (log.metadata != null && log.metadata!.isNotEmpty) ...<Widget>[
                const SizedBox(height: 8),
                const SectionHeader('Metadata'),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(AppColors.radiusInput),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    _prettyMetadata(log.metadata),
                    style: AppText.bodyMd.copyWith(
                      fontFamily: 'monospace',
                      color: AppColors.ink,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading && _page == null) {
      return const LoadingState(label: 'Memuat jejak audit');
    }
    if (_error != null && _page == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AdminAuditLog> items = _page?.items ?? const <AdminAuditLog>[];
    final List<String>? actions = _actions;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          AdminSearchField(
            hint: 'Cari email aktor',
            onSubmitted: (String v) {
              _search = v;
              _pageNo = 1;
              _load();
            },
          ),
          const SizedBox(height: 8),
          AdminFilterChips(
            values: const <String?>[null, 'SUCCESS', 'FAILED', 'DENIED'],
            selected: _result,
            labels: const <String, String>{
              'all': 'Semua',
              'SUCCESS': 'Sukses',
              'FAILED': 'Gagal',
              'DENIED': 'Ditolak',
            },
            onChanged: (String? v) {
              _result = v;
              _pageNo = 1;
              _load();
            },
          ),
          if (actions != null) ...<Widget>[
            const SizedBox(height: 4),
            AdminFilterChips(
              values: <String?>[null, ...actions],
              selected: _action,
              labels: const <String, String>{'all': 'Semua aksi'},
              onChanged: (String? v) {
                _action = v;
                _pageNo = 1;
                _load();
              },
            ),
          ],
          const SizedBox(height: 4),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickRange,
                  icon: const Icon(Icons.date_range, size: 18),
                  label: Text(
                    _range == null
                        ? 'Rentang tanggal'
                        : '${adminShortDate(_range!.start)} – '
                            '${adminShortDate(_range!.end)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              if (_range != null) ...<Widget>[
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Hapus rentang',
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: _clearRange,
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 32),
              child: AdminEmpty(
                icon: Icons.fact_check_outlined,
                title: 'Tidak ada jejak audit',
                subtitle: 'Coba ubah filter atau kata kunci.',
              ),
            )
          else
            for (final AdminAuditLog log in items) ...<Widget>[
              AdminTile(
                icon: Icons.history,
                title: '${log.action} · ${log.targetSummary}',
                subtitle: '${log.actorLabel} · ${adminDateTime(log.timestamp)}',
                accent: switch (log.result) {
                  'FAILED' => AppColors.error,
                  'DENIED' => AppColors.roseFill,
                  _ => null,
                },
                trailing: _resultPill(log.result),
                onTap: () => _openDetail(log),
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
      title: 'Jejak Audit',
      subtitle: '${_page?.totalItems ?? 0} entri tercatat',
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
