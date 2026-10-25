import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';

String adminErrorText(Object error) {
  if (error is DioException) {
    final Object? data = error.response?.data;
    if (data is Map) {
      final Object? message = data['message'];
      if (message is String && message.isNotEmpty) return message;
      if (message is List && message.isNotEmpty) return message.join('\n');
    }
    final int? code = error.response?.statusCode;
    if (code == 401 || code == 403) return 'Akses ditolak server ($code).';
    if (code != null) return 'Server menolak permintaan (HTTP $code).';
    return 'Tidak dapat menghubungi server.';
  }
  final String s = error.toString();
  return s.length <= 160 ? s : '${s.substring(0, 157)}...';
}

void showAdminSnack(BuildContext context, String message,
    {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: error ? AppColors.error : null,
    ),
  );
}

Future<bool> confirmAdminAction(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Lanjutkan',
  bool destructive = false,
}) async {
  final bool? ok = await showDialog<bool>(
    context: context,
    builder: (BuildContext ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Batal'),
        ),
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(backgroundColor: AppColors.error)
              : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok == true;
}

class AdminScaffold extends StatelessWidget {
  const AdminScaffold({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    required this.child,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: StitchHeader(
        title: title,
        subtitle: subtitle,
        onBack: () => Navigator.of(context).maybePop(),
        trailing: actions == null || actions!.isEmpty
            ? null
            : Row(mainAxisSize: MainAxisSize.min, children: actions!),
      ),
      body: child,
    );
  }
}

class AdminTile extends StatelessWidget {
  const AdminTile({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.trailing,
    this.onTap,
    this.accent,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      accent: accent,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: AppText.bodyMdMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle != null) ...<Widget>[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style:
                        AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...<Widget>[
            const SizedBox(width: 8),
            trailing!,
          ],
        ],
      ),
    );
  }
}

class AdminFilterChips extends StatelessWidget {
  const AdminFilterChips({
    super.key,
    required this.values,
    required this.selected,
    required this.onChanged,
    this.labels = const <String, String>{},
  });

  final List<String?> values;
  final String? selected;
  final ValueChanged<String?> onChanged;
  final Map<String, String> labels;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: <Widget>[
          for (final String? v in values) ...<Widget>[
            ChoiceChip(
              label: Text(labels[v ?? 'all'] ?? v ?? 'Semua'),
              selected: selected == v,
              onSelected: (_) => onChanged(v),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class AdminSearchField extends StatefulWidget {
  const AdminSearchField({
    super.key,
    required this.hint,
    required this.onSubmitted,
  });

  final String hint;
  final ValueChanged<String> onSubmitted;

  @override
  State<AdminSearchField> createState() => _AdminSearchFieldState();
}

class _AdminSearchFieldState extends State<AdminSearchField> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      textInputAction: TextInputAction.search,
      onSubmitted: widget.onSubmitted,
      decoration: InputDecoration(
        hintText: widget.hint,
        prefixIcon: const Icon(Icons.search, size: 20),
        suffixIcon: IconButton(
          tooltip: 'Hapus',
          icon: const Icon(Icons.close, size: 18),
          onPressed: () {
            _controller.clear();
            widget.onSubmitted('');
          },
        ),
      ),
    );
  }
}

class AdminPager extends StatelessWidget {
  const AdminPager({
    super.key,
    required this.page,
    required this.totalPages,
    required this.onChanged,
  });

  final int page;
  final int totalPages;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    if (totalPages <= 1) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          IconButton(
            onPressed: page > 1 ? () => onChanged(page - 1) : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Text('Halaman $page dari $totalPages', style: AppText.labelSm),
          IconButton(
            onPressed: page < totalPages ? () => onChanged(page + 1) : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

class AdminEmpty extends StatelessWidget {
  const AdminEmpty({
    super.key,
    this.title = 'Belum ada data',
    this.subtitle,
    this.icon = Icons.inbox_outlined,
  });

  final String title;
  final String? subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return EmptyState(icon: icon, title: title, subtitle: subtitle);
  }
}

class AdminError extends StatelessWidget {
  const AdminError({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppColors.pageMargin),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          InfoBanner(
            message,
            tone: InfoBannerTone.error,
            title: 'Gagal memuat data',
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Coba Lagi'),
          ),
        ],
      ),
    );
  }
}

String adminDate(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

String adminShortDate(DateTime? dt) {
  if (dt == null) return '—';
  const List<String> months = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  final DateTime l = dt.toLocal();
  return '${l.day} ${months[l.month - 1]} ${l.year}';
}

String adminDateTime(DateTime? dt) {
  if (dt == null) return '—';
  final DateTime l = dt.toLocal();
  final String hh = l.hour.toString().padLeft(2, '0');
  final String mm = l.minute.toString().padLeft(2, '0');
  return '${adminShortDate(l)} $hh:$mm';
}
