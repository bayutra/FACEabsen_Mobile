import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/privacy_admin_repository.dart';
import '../domain/privacy_admin_models.dart';

class PrivacyAdminScreen extends StatefulWidget {
  const PrivacyAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<PrivacyAdminScreen> createState() => _PrivacyAdminScreenState();
}

class _PrivacyAdminScreenState extends State<PrivacyAdminScreen> {
  late final PrivacyAdminRepository _repo =
      PrivacyAdminRepository(dio: widget.dio);

  PrivacyNotice? _notice;
  String? _error;
  bool _loading = true;
  bool _running = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final PrivacyNotice notice = await _repo.notice();
      if (!mounted) return;
      setState(() {
        _notice = notice;
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

  String _retentionMessage(Map<String, dynamic> res) {
    final Object? message = res['message'];
    if (message is String && message.isNotEmpty) return message;
    final Object? deleted = res['deleted'] ?? res['removed'] ?? res['count'];
    if (deleted is num && deleted > 0) {
      return 'Pembersihan retensi selesai. $deleted data dihapus.';
    }
    return 'Pembersihan retensi selesai.';
  }

  Future<void> _runRetention() async {
    final bool ok = await confirmAdminAction(
      context,
      title: 'Jalankan pembersihan retensi?',
      message: 'Data yang sudah melewati masa retensi akan dihapus permanen '
          'sesuai kebijakan privasi. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Jalankan',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _running = true);
    try {
      final Map<String, dynamic> res = await _repo.runRetention();
      if (!mounted) return;
      setState(() => _running = false);
      showAdminSnack(context, _retentionMessage(res));
    } catch (e) {
      if (!mounted) return;
      setState(() => _running = false);
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  Widget _body() {
    if (_loading && _notice == null) {
      return const LoadingState(label: 'Memuat kebijakan privasi');
    }
    if (_error != null && _notice == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final PrivacyNotice? notice = _notice;
    if (notice == null) return const SizedBox.shrink();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          AppCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(notice.title, style: AppText.headlineSm),
                    ),
                    AppPill(
                      'v${notice.version}',
                      AppColors.tealBadgeBg,
                      AppColors.tealBadgeText,
                      border: AppColors.tealBadgeBorder,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                for (int i = 0; i < notice.body.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text('${i + 1}. ', style: AppText.bodyMd),
                        Expanded(
                          child: Text(notice.body[i], style: AppText.bodyMd),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const InfoBanner(
            'Pembersihan retensi menghapus data yang sudah melewati masa '
            'simpan sesuai kebijakan di atas. Tindakan ini permanen.',
            tone: InfoBannerTone.warning,
            title: 'Retensi data',
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _running ? null : _runRetention,
            icon: _running
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.delete_sweep_outlined),
            label: Text(_running ? 'Menjalankan…' : 'Jalankan Retensi'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Privasi & Retensi',
      subtitle: 'Kebijakan data & pembersihan',
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
