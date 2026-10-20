import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/user_admin_repository.dart';
import '../domain/user_admin_models.dart';

/// Formulir tambah pengguna (SUPER_ADMIN): email, password, dan peran.
class UserAdminFormScreen extends StatefulWidget {
  const UserAdminFormScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<UserAdminFormScreen> createState() => _UserAdminFormScreenState();
}

class _UserAdminFormScreenState extends State<UserAdminFormScreen> {
  late final UserAdminRepository _repo = UserAdminRepository(dio: widget.dio);
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final Set<String> _roles = <String>{'EMPLOYEE'};
  bool _saving = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      await _repo.create(
        email: _email.text,
        password: _password.text,
        roles: _roles.toList(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Pengguna Baru',
      subtitle: 'Akun & peran akses',
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppColors.pageMargin),
          children: <Widget>[
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (String? v) {
                final String s = (v ?? '').trim();
                if (s.isEmpty) return 'Wajib diisi.';
                if (!s.contains('@') || !s.contains('.')) {
                  return 'Format email tidak valid.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Password awal',
                helperText: 'Minimal 8 karakter',
              ),
              validator: (String? v) =>
                  (v ?? '').length < 8 ? 'Minimal 8 karakter.' : null,
            ),
            const SizedBox(height: 16),
            const SectionHeader('Peran akun'),
            Wrap(
              spacing: 8,
              children: <Widget>[
                for (final String r in kAdminRoles)
                  FilterChip(
                    label: Text(r),
                    selected: _roles.contains(r),
                    onSelected: (bool on) => setState(() {
                      if (on) {
                        _roles.add(r);
                      } else if (_roles.length > 1) {
                        _roles.remove(r);
                      }
                    }),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Menyimpan…' : 'Simpan'),
            ),
          ],
        ),
      ),
    );
  }
}
