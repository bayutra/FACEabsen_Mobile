import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/employee_admin_repository.dart';
import '../domain/employee_admin_models.dart';

/// Formulir tambah/ubah karyawan.
///
/// `canEditAll = false` dipakai supervisor: hanya nama, telepon, dan jabatan
/// yang dapat diubah; email login, unit, dan status tetap milik admin.
class EmployeeAdminFormScreen extends StatefulWidget {
  const EmployeeAdminFormScreen({
    super.key,
    required this.dio,
    this.employee,
    this.canEditAll = true,
  });

  final Dio dio;
  final AdminEmployee? employee;
  final bool canEditAll;

  @override
  State<EmployeeAdminFormScreen> createState() => _EmployeeAdminFormScreenState();
}

class _EmployeeAdminFormScreenState extends State<EmployeeAdminFormScreen> {
  late final EmployeeAdminRepository _repo = EmployeeAdminRepository(dio: widget.dio);
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  final TextEditingController _no = TextEditingController();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _position = TextEditingController();
  final TextEditingController _password = TextEditingController();

  List<AdminDepartment> _departments = const <AdminDepartment>[];
  String? _departmentId;
  final Set<String> _roles = <String>{'EMPLOYEE'};
  bool _saving = false;

  bool get _editing => widget.employee != null;

  @override
  void initState() {
    super.initState();
    final AdminEmployee? e = widget.employee;
    if (e != null) {
      _no.text = e.employeeNo;
      _name.text = e.name;
      _email.text = e.email;
      _phone.text = e.phone ?? '';
      _position.text = e.position ?? '';
      _departmentId = e.departmentId;
    }
    _loadDepartments();
  }

  Future<void> _loadDepartments() async {
    try {
      final List<AdminDepartment> list = await _repo.departments();
      if (mounted) setState(() => _departments = list);
    } catch (_) {
      // Pemilih Unit opsional; form tetap bisa disimpan tanpa itu.
    }
  }

  @override
  void dispose() {
    _no.dispose();
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _position.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      if (_editing) {
        await _repo.update(
          widget.employee!.id,
          name: _name.text,
          email: widget.canEditAll ? _email.text : null,
          phone: _phone.text,
          position: _position.text,
          departmentId: widget.canEditAll ? _departmentId : null,
        );
      } else {
        await _repo.create(
          employeeNo: _no.text,
          name: _name.text,
          email: _email.text,
          password: _password.text,
          phone: _phone.text,
          position: _position.text,
          departmentId: _departmentId,
          roles: _roles.toList(),
        );
      }
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
      title: _editing ? 'Ubah Karyawan' : 'Karyawan Baru',
      subtitle: _editing ? widget.employee!.employeeNo : 'Akun + data SDM',
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppColors.pageMargin),
          children: <Widget>[
            if (_editing && !widget.canEditAll) ...<Widget>[
              const InfoBanner(
                'Sebagai supervisor Anda dapat mengubah nama, telepon, dan '
                'jabatan anggota unit/tim. Perubahan unit, email login, dan '
                'status akun dilakukan admin.',
                tone: InfoBannerTone.info,
                title: 'Wewenang supervisor',
              ),
              const SizedBox(height: 16),
            ],
            if (!_editing) ...<Widget>[
              TextFormField(
                controller: _no,
                decoration: const InputDecoration(
                  labelText: 'NIP / Nomor karyawan',
                  hintText: 'EMP-005',
                ),
                validator: (String? v) {
                  final String s = (v ?? '').trim();
                  if (s.isEmpty) return 'Wajib diisi.';
                  if (!RegExp(r'^[A-Za-z0-9-]+$').hasMatch(s)) {
                    return 'Hanya huruf, angka, dan tanda hubung.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Nama lengkap'),
              validator: (String? v) =>
                  (v ?? '').trim().length < 2 ? 'Minimal 2 karakter.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              enabled: widget.canEditAll,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: 'Email',
                helperText: widget.canEditAll
                    ? null
                    : 'Hanya admin yang dapat mengubah email login.',
              ),
              validator: (String? v) {
                final String s = (v ?? '').trim();
                if (s.isEmpty) return 'Wajib diisi.';
                if (!s.contains('@') || !s.contains('.')) return 'Format email tidak valid.';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Telepon (opsional)'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _position,
              decoration: const InputDecoration(labelText: 'Jabatan (opsional)'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _departmentId,
              decoration: InputDecoration(
                labelText: 'Unit',
                helperText: widget.canEditAll
                    ? null
                    : 'Unit hanya dapat diubah admin.',
              ),
              items: <DropdownMenuItem<String>>[
                const DropdownMenuItem<String>(value: null, child: Text('â€”')),
                for (final AdminDepartment d in _departments)
                  DropdownMenuItem<String>(value: d.id, child: Text(d.name)),
              ],
              onChanged: widget.canEditAll
                  ? (String? v) => setState(() => _departmentId = v)
                  : null,
            ),
            if (!_editing) ...<Widget>[
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
                  for (final String r in const <String>[
                    'EMPLOYEE',
                    'SUPERVISOR',
                    'ADMIN',
                    'SUPER_ADMIN',
                  ])
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
            ],
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
              label: Text(_saving ? 'Menyimpanâ€¦' : 'Simpan'),
            ),
          ],
        ),
      ),
    );
  }
}
