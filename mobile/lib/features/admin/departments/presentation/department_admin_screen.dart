import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/department_admin_repository.dart';

/// Kelola master data departemen rumah sakit (ADMIN).
///
/// Tambah/ubah nama departemen, pilih rumah sakit induk saat membuat baru,
/// dan hapus dengan peringatan bila masih ada karyawan yang terhubung.
class DepartmentAdminScreen extends StatefulWidget {
  const DepartmentAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<DepartmentAdminScreen> createState() => _DepartmentAdminScreenState();
}

class _DepartmentAdminScreenState extends State<DepartmentAdminScreen> {
  late final DepartmentAdminRepository _repo =
      DepartmentAdminRepository(dio: widget.dio);

  List<AdminDepartmentItem> _items = const <AdminDepartmentItem>[];
  List<DepartmentHospital> _hospitals = const <DepartmentHospital>[];
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
      final List<AdminDepartmentItem> items = await _repo.list();
      if (!mounted) return;
      setState(() {
        _items = items;
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
    await _loadHospitals();
  }

  /// Pemilih rumah sakit hanya dibutuhkan saat menambah departemen, jadi
  /// kegagalannya tidak boleh menutupi daftar yang sudah tampil.
  Future<void> _loadHospitals() async {
    try {
      final List<DepartmentHospital> hospitals = await _repo.hospitals();
      if (!mounted) return;
      setState(() => _hospitals = hospitals);
    } catch (_) {
      // Dicoba lagi saat tombol tambah ditekan.
    }
  }

  Future<void> _openForm([AdminDepartmentItem? department]) async {
    if (department == null && _hospitals.isEmpty) {
      await _loadHospitals();
      if (!mounted) return;
      if (_hospitals.isEmpty) {
        showAdminSnack(
          context,
          'Daftar rumah sakit belum tersedia. Periksa koneksi lalu coba lagi.',
          error: true,
        );
        return;
      }
    }
    if (!mounted) return;

    final bool? saved = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => _DepartmentFormDialog(
        repo: _repo,
        hospitals: _hospitals,
        department: department,
      ),
    );
    if (saved == true && mounted) {
      showAdminSnack(
        context,
        department == null
            ? 'Departemen ditambahkan.'
            : 'Departemen diperbarui.',
      );
      await _load();
    }
  }

  Future<void> _delete(AdminDepartmentItem department) async {
    final bool ok = await confirmAdminAction(
      context,
      title: 'Hapus ${department.name}?',
      message: 'Departemen yang masih memiliki karyawan tidak dapat dihapus. '
          'Pindahkan karyawan yang terhubung terlebih dahulu agar jadwal dan '
          'presensi mereka tetap utuh.',
      confirmLabel: 'Hapus',
      destructive: true,
    );
    if (!ok || !mounted) return;

    try {
      await _repo.delete(department.id);
      if (!mounted) return;
      showAdminSnack(context, '${department.name} dihapus.');
      await _load();
    } catch (e) {
      if (!mounted) return;
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  Widget _body() {
    if (_loading && _items.isEmpty) {
      return const LoadingState(label: 'Memuat departemen');
    }
    if (_error != null && _items.isEmpty) {
      return AdminError(message: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          if (_error != null) ...<Widget>[
            InfoBanner(_error!, tone: InfoBannerTone.error),
            const SizedBox(height: 12),
          ],
          if (_items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Column(
                children: <Widget>[
                  const AdminEmpty(
                    icon: Icons.apartment_outlined,
                    title: 'Belum ada departemen',
                    subtitle: 'Tambahkan unit kerja agar karyawan bisa '
                        'dikelompokkan.',
                  ),
                  FilledButton.icon(
                    onPressed: () => _openForm(),
                    icon: const Icon(Icons.add),
                    label: const Text('Tambah Departemen'),
                  ),
                ],
              ),
            )
          else
            for (final AdminDepartmentItem department in _items) ...<Widget>[
              AdminTile(
                icon: Icons.apartment_outlined,
                title: department.name,
                subtitle: department.hospitalLabel,
                onTap: () => _openForm(department),
                trailing: PopupMenuButton<String>(
                  tooltip: 'Aksi departemen',
                  onSelected: (String value) {
                    if (value == 'edit') {
                      _openForm(department);
                    } else if (value == 'delete') {
                      _delete(department);
                    }
                  },
                  itemBuilder: (BuildContext ctx) =>
                      const <PopupMenuEntry<String>>[
                    PopupMenuItem<String>(
                      value: 'edit',
                      child: Text('Ubah nama'),
                    ),
                    PopupMenuItem<String>(
                      value: 'delete',
                      child: Text('Hapus'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 24),
          Text(
            'Total ${_items.length} departemen',
            style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Departemen',
      subtitle: 'Unit kerja & rumah sakit induk',
      actions: <Widget>[
        IconButton(
          tooltip: 'Tambah departemen',
          onPressed: () => _openForm(),
          icon: const Icon(Icons.add),
        ),
      ],
      child: _body(),
    );
  }
}

class _DepartmentFormDialog extends StatefulWidget {
  const _DepartmentFormDialog({
    required this.repo,
    required this.hospitals,
    this.department,
  });

  final DepartmentAdminRepository repo;
  final List<DepartmentHospital> hospitals;
  final AdminDepartmentItem? department;

  @override
  State<_DepartmentFormDialog> createState() => _DepartmentFormDialogState();
}

class _DepartmentFormDialogState extends State<_DepartmentFormDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _name = TextEditingController();

  String? _hospitalId;
  String? _error;
  bool _saving = false;

  bool get _editing => widget.department != null;

  @override
  void initState() {
    super.initState();
    _name.text = widget.department?.name ?? '';
    _hospitalId = widget.department?.hospitalId ??
        (widget.hospitals.isEmpty ? null : widget.hospitals.first.id);
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (_editing) {
        await widget.repo.update(widget.department!.id, name: _name.text);
      } else {
        await widget.repo.create(
          hospitalId: _hospitalId!,
          name: _name.text,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = adminErrorText(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_editing ? 'Ubah Departemen' : 'Departemen Baru'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              TextFormField(
                controller: _name,
                autofocus: true,
                textCapitalization: TextCapitalization.words,
                maxLength: 64,
                decoration: const InputDecoration(
                  labelText: 'Nama departemen',
                  hintText: 'Contoh: Instalasi Rawat Inap',
                ),
                validator: (String? value) {
                  final String name = (value ?? '').trim();
                  if (name.length < 2) return 'Minimal 2 karakter.';
                  if (name.length > 64) return 'Maksimal 64 karakter.';
                  return null;
                },
              ),
              const SizedBox(height: 8),
              if (_editing)
                InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Rumah sakit',
                    helperText: 'Rumah sakit tidak dapat diubah.',
                  ),
                  child: Text(
                    widget.department!.hospitalLabel,
                    style: AppText.bodyMdMedium,
                  ),
                )
              else
                DropdownButtonFormField<String>(
                  value: _hospitalId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Rumah sakit',
                  ),
                  items: <DropdownMenuItem<String>>[
                    for (final DepartmentHospital hospital in widget.hospitals)
                      DropdownMenuItem<String>(
                        value: hospital.id,
                        child: Text(hospital.label),
                      ),
                  ],
                  onChanged: (String? value) =>
                      setState(() => _hospitalId = value),
                  validator: (String? value) =>
                      value == null ? 'Pilih rumah sakit.' : null,
                ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 12),
                InfoBanner(_error!, tone: InfoBannerTone.error),
              ],
            ],
          ),
        ),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Batal'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Simpan'),
        ),
      ],
    );
  }
}
