import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/hospital_mark.dart';
import '../../../core/widgets/stitch.dart';
import '../../device/data/device_repository.dart';
import '../data/auth_repository.dart';







class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    required this.auth,
    required this.devices,
  });

  final AuthRepository auth;
  final DeviceRepository devices;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _employeeNo = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscurePassword = true;
  bool _busy = false;
  String? _error;

  List<RegistrationUnit> _units = const [];
  bool _unitsLoading = true;
  String? _unitsError;
  String? _unitId;

  @override
  void initState() {
    super.initState();
    _loadUnits();
  }

  Future<void> _loadUnits() async {
    setState(() {
      _unitsLoading = true;
      _unitsError = null;
    });
    try {
      final List<RegistrationUnit> units = await widget.auth.listUnits();
      if (!mounted) return;
      setState(() {
        _units = units;
        _unitsLoading = false;
        if (_unitId != null && !units.any((u) => u.id == _unitId)) {
          _unitId = null;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _unitsLoading = false;
        _unitsError =
            'Gagal memuat daftar unit. Periksa koneksi lalu coba lagi.';
      });
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _employeeNo.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final String name = _name.text.trim();
    final String email = _email.text.trim();
    final String password = _password.text;

    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Nama, email, dan kata sandi wajib diisi.');
      return;
    }
    if (!email.contains('@')) {
      setState(() => _error = 'Format email tidak valid.');
      return;
    }
    if (password.length < 8) {
      setState(() => _error = 'Kata sandi minimal 8 karakter.');
      return;
    }
    if (password != _confirm.text) {
      setState(() => _error = 'Konfirmasi kata sandi tidak sama.');
      return;
    }
    if (_unitId == null || _unitId!.isEmpty) {
      setState(() => _error = 'Unit kerja wajib dipilih.');
      return;
    }

    setState(() {
      _error = null;
      _busy = true;
    });

    try {
      await widget.auth.register(
        name: name,
        email: email,
        password: password,
        phone: _phone.text.trim(),
        employeeNo: _employeeNo.text.trim(),
        departmentId: _unitId,
      );

      
      
      try {
        await widget.devices.register();
      } catch (_) {}

      if (!mounted) return;
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
        _error = 'Terjadi kesalahan sistem. Silakan coba lagi.';
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
      return 'Email atau nomor karyawan sudah terdaftar. Gunakan email lain atau hubungi Kepegawaian.';
    }
    if (code == 400) {
      return 'Kata sandi terlalu lemah. Gunakan minimal 8 karakter dengan huruf besar, huruf kecil, dan angka.';
    }
    if (code == 429) {
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    }
    return 'Pendaftaran gagal (${code ?? 'tanpa kode'}).';
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: AppText.labelMd.copyWith(color: AppColors.ink)),
      );

  Widget _unitField() {
    Widget child;
    if (_unitsLoading) {
      child = Row(
        children: [
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 10),
          Text(
            'Memuat unit kerja...',
            style: AppText.labelMd.copyWith(color: AppColors.inkSecondary),
          ),
        ],
      );
    } else if (_unitsError != null) {
      child = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InfoBanner(
            _unitsError!,
            tone: InfoBannerTone.error,
            title: 'Unit tidak termuat',
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _loadUnits,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Coba lagi'),
            ),
          ),
        ],
      );
    } else if (_units.isEmpty) {
      child = const InfoBanner(
        'Belum ada unit kerja terdaftar. Hubungi admin kepegawaian untuk '
        'menambahkan unit sebelum mendaftar.',
        tone: InfoBannerTone.warning,
        title: 'Unit belum tersedia',
      );
    } else {
      child = DropdownButtonFormField<String>(
        value: _unitId,
        isExpanded: true,
        decoration: const InputDecoration(
          hintText: 'Pilih unit kerja Anda',
          prefixIcon: Icon(Icons.apartment_outlined),
        ),
        items: _units
            .map(
              (u) => DropdownMenuItem<String>(
                value: u.id,
                child: Text(u.name, overflow: TextOverflow.ellipsis),
              ),
            )
            .toList(),
        onChanged: _busy
            ? null
            : (String? value) => setState(() => _unitId = value),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _label('Unit Kerja *'),
        child,
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        elevation: 0,
        foregroundColor: AppColors.ink,
        title: Text(
          'Daftar Akun',
          style: AppText.headlineSm.copyWith(color: AppColors.ink),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppColors.pageMargin,
            vertical: 16,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const HospitalMark(size: 40),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'RS Absen',
                          style: AppText.headlineSm.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          'Pendaftaran akun karyawan baru',
                          style: AppText.labelSm.copyWith(
                            color: AppColors.inkSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              AppCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _label('Nama Lengkap *'),
                    TextField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        hintText: 'Nama sesuai data kepegawaian',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _label('Email *'),
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        hintText: 'nama@rumahsakit.example',
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _label('Nomor HP'),
                    TextField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        hintText: '08xxxxxxxxxx (opsional)',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _unitField(),
                    const SizedBox(height: 16),
                    _label('Nomor Induk Pegawai'),
                    TextField(
                      controller: _employeeNo,
                      decoration: const InputDecoration(
                        hintText: 'Kosongkan untuk dibuat otomatis',
                        prefixIcon: Icon(Icons.badge_outlined),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _label('Kata Sandi *'),
                    TextField(
                      controller: _password,
                      obscureText: _obscurePassword,
                      decoration: InputDecoration(
                        hintText: 'Minimal 8 karakter, huruf besar & angka',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _label('Ulangi Kata Sandi *'),
                    TextField(
                      controller: _confirm,
                      obscureText: true,
                      decoration: const InputDecoration(
                        hintText: '••••••••••••',
                        prefixIcon: Icon(Icons.lock_reset_outlined),
                      ),
                      onSubmitted: (_) => _busy ? null : _submit(),
                    ),
                    const SizedBox(height: 12),
                    if (_error != null) ...[
                      InfoBanner(
                        _error!,
                        tone: InfoBannerTone.error,
                        title: 'Pendaftaran gagal',
                      ),
                      const SizedBox(height: 16),
                    ],
                    SizedBox(
                      width: double.infinity,
                      height: AppColors.buttonHeight,
                      child: FilledButton(
                        onPressed: (_busy ||
                                _unitsLoading ||
                                _unitsError != null ||
                                _units.isEmpty)
                            ? null
                            : _submit,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _busy ? 'Mendaftarkan...' : 'Daftar & Masuk',
                              style: AppText.bodyLgMedium.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward,
                                size: 20, color: Colors.white),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Akun baru otomatis mendapat akses karyawan (presensi, izin, koreksi). '
                'Akses supervisor/admin diberikan oleh admin kepegawaian.',
                textAlign: TextAlign.center,
                style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
