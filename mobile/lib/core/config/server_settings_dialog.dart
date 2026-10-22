import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'server_settings.dart';

Future<bool> showServerSettingsDialog(
    BuildContext context, ServerSettings settings) async {
  final TextEditingController controller =
      TextEditingController(text: settings.baseUrl);
  String? error;
  bool saved = false;

  await showDialog<void>(
    context: context,
    builder: (BuildContext ctx) => StatefulBuilder(
      builder: (BuildContext ctx, void Function(void Function()) setState) =>
          AlertDialog(
        title: const Text('Server API'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'Alamat backend yang dipakai aplikasi. Kosongkan untuk kembali ke default.',
                style: AppText.bodyMd.copyWith(color: AppColors.inkSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                keyboardType: TextInputType.url,
                autocorrect: false,
                enableSuggestions: false,
                decoration: InputDecoration(
                  hintText: 'https://contoh.ngrok-free.app',
                  errorText: error,
                  prefixIcon: const Icon(Icons.dns_outlined),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Default: ${settings.defaultBaseUrl}',
                style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
              ),
            ],
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => setState(() {
              controller.text = '';
              error = null;
            }),
            child: const Text('Default'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () async {
              try {
                await settings.apply(controller.text);
                saved = true;
                if (ctx.mounted) Navigator.of(ctx).pop();
              } on FormatException {
                setState(() => error = 'Format alamat tidak valid.');
              }
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    ),
  );

  controller.dispose();
  return saved;
}
