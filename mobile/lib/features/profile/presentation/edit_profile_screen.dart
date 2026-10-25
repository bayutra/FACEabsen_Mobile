import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../data/profile_repository.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({
    super.key,
    required this.profiles,
    required this.snapshot,
  });

  final ProfileRepository profiles;
  final ProfileSnapshot snapshot;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _name =
      TextEditingController(text: widget.snapshot.name);
  late final TextEditingController _email =
      TextEditingController(text: widget.snapshot.email);
  late final TextEditingController _phone =
      TextEditingController(text: widget.snapshot.phone);

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final String name = _name.text.trim();
    final String email = _email.text.trim();

    if (name.length < 2) {
      setState(() => _error = 'Nama minimal 2 karakter.');
      return;
    }
    if (!email.contains('@') || email.length < 5) {
      setState(() => _error = 'Format email tidak valid.');
      return;
    }

    setState(() {
      _error = null;
      _busy = true;
    });

    try {
      await widget.profiles.updateProfile(
        name: name,
        email: email,
        phone: _phone.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil diperbarui.')),
      );
      Navigator.of(context).pop(true);
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _messageFor(e);
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal menyimpan profil. Silakan coba lagi.';
        _busy = false;
      });
    }
  }

  String _messageFor(DioException e) {
    final int? code = e.response?.statusCode;
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Server tidak terjangkau. Periksa koneksi jaringan rumah sakit.';
    }
    if (code == 409) {
      return 'Email tersebut sudah dipakai akun lain. Gunakan email lain.';
    }
    if (code == 400) {
      return 'Data belum valid. Periksa nama dan email, lalu coba lagi.';
    }
    return 'Gagal menyimpan profil (${code ?? 'tanpa kode'}).';
  }

  InputDecoration _decoration(String label, IconData icon, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Icon(icon),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLow,
        elevation: 0,
        foregroundColor: AppColors.ink,
        title: Text(
          'Ubah Profil',
          style: AppText.headlineSm.copyWith(color: AppColors.ink),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppColors.pageMargin,
            vertical: 16,
          ),
          children: [
            AppCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    enabled: !_busy,
                    decoration: _decoration(
                      'Nama Lengkap',
                      Icons.person_outline,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    enabled: !_busy,
                    decoration: _decoration(
                      'Email (untuk masuk)',
                      Icons.mail_outline,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    enabled: !_busy,
                    decoration: _decoration(
                      'Nomor HP',
                      Icons.phone_outlined,
                      hint: '08xxxxxxxxxx (opsional)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Mengubah email berarti Anda harus memakai email baru '
                    'saat masuk berikutnya.',
                    style: AppText.labelSm.copyWith(
                      color: AppColors.inkSecondary,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    InfoBanner(
                      _error!,
                      tone: InfoBannerTone.error,
                      title: 'Profil gagal disimpan',
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    height: AppColors.buttonHeight,
                    child: FilledButton(
                      onPressed: _busy ? null : _save,
                      child: Text(
                        _busy ? 'Menyimpan...' : 'Simpan Perubahan',
                        style: AppText.bodyLgMedium.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'DATA KEPEGAWAIAN',
                    style: AppText.labelSm.copyWith(
                      color: AppColors.inkSecondary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _readOnlyRow('NIP', widget.snapshot.employeeNo),
                  const SizedBox(height: 10),
                  _readOnlyRow('Unit Kerja', widget.snapshot.department),
                  const SizedBox(height: 10),
                  _readOnlyRow('Jabatan', widget.snapshot.position),
                  const SizedBox(height: 10),
                  Text(
                    'Perubahan unit kerja, NIP, dan jabatan dilakukan oleh '
                    'admin kepegawaian.',
                    style: AppText.labelSm.copyWith(
                      color: AppColors.inkSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _readOnlyRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
          ),
        ),
        Expanded(
          child: Text(
            value.isEmpty ? '—' : value,
            style: AppText.labelMd.copyWith(
              color: AppColors.ink,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
