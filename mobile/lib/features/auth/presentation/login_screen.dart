import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;
import 'package:flutter/material.dart';

import '../../../core/config/server_settings.dart';
import '../../../core/config/server_settings_dialog.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/hospital_mark.dart';
import '../../../core/widgets/stitch.dart';
import '../data/auth_repository.dart';
import '../../device/data/device_repository.dart';
import 'register_screen.dart';
import 'verify_email_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.auth,
    required this.devices,
    required this.onDone,
    this.servers,
  });

  final AuthRepository auth;
  final DeviceRepository devices;
  final VoidCallback onDone;

  final ServerSettings? servers;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _recoveryCode = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = true;
  String? _error;
  String? _unverifiedEmail;
  bool _busy = false;

  String? _totpToken;
  bool _useRecovery = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    _recoveryCode.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final String credential = _email.text.trim();
    final String password = _password.text;

    if (credential.isEmpty || password.isEmpty) {
      setState(() {
        _error = 'Email dan Kata Sandi wajib diisi.';
      });
      return;
    }

    setState(() {
      _error = null;
      _unverifiedEmail = null;
      _busy = true;
    });

    try {
      await widget.auth.login(
        email: credential,
        password: password,
        rememberMe: _rememberMe,
      );
      await _finishSession();
    } on TotpChallengeException catch (e) {
      if (!mounted) return;
      setState(() {
        _totpToken = e.totpToken;
        _useRecovery = false;
        _error = null;
        _busy = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _messageFor(e);
        _unverifiedEmail =
            _reason(e) == 'EMAIL_NOT_VERIFIED' ? credential : null;
        _busy = false;
      });
    } catch (e) {
      if (kDebugMode) debugPrint('login failed: $e');
      if (!mounted) return;
      setState(() {
        _error = 'Terjadi kesalahan sistem. Silakan coba lagi.';
        _busy = false;
      });
    }
  }

  Future<void> _finishSession() async {
    try {
      await widget.devices.register();
    } catch (_) {}
    if (!mounted) return;
    widget.onDone();
  }

  Future<void> _openRegister() async {
    final bool? registered = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => RegisterScreen(
          auth: widget.auth,
          devices: widget.devices,
        ),
      ),
    );
    if (registered == true && mounted) widget.onDone();
  }

  Future<void> _submitTotp() async {
    final String token = _totpToken ?? '';
    final String second =
        _useRecovery ? _recoveryCode.text.trim() : _code.text.trim();

    if (token.isEmpty || second.isEmpty) {
      setState(() {
        _error = _useRecovery
            ? 'Kode pemulihan wajib diisi.'
            : 'Kode autentikator 6 digit wajib diisi.';
      });
      return;
    }

    setState(() {
      _error = null;
      _busy = true;
    });

    try {
      if (_useRecovery) {
        await widget.auth.recoverTotp(
          totpToken: token,
          recoveryCode: second,
          rememberMe: _rememberMe,
        );
      } else {
        await widget.auth.verifyTotp(
          totpToken: token,
          code: second,
          rememberMe: _rememberMe,
        );
      }
      await _finishSession();
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _messageFor(e);
        _busy = false;
      });
    } catch (e) {
      if (kDebugMode) debugPrint('totp submit failed: $e');
      if (!mounted) return;
      setState(() {
        _error = 'Terjadi kesalahan sistem. Silakan coba lagi.';
        _busy = false;
      });
    }
  }

  String? _reason(DioException e) {
    final Object? data = e.response?.data;
    return data is Map ? data['reason'] as String? : null;
  }

  String _messageFor(DioException e) {
    final int? code = e.response?.statusCode;
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Server tidak terjangkau. Periksa koneksi jaringan rumah sakit.';
    }
    if (code == 401) return 'Kredensial atau kata sandi tidak sesuai.';
    if (code == 403) {
      final String? reason = _reason(e);
      if (reason == 'EMAIL_NOT_VERIFIED') {
        return 'Email belum diverifikasi. Masukkan kode verifikasi terlebih dahulu.';
      }
      if (reason == 'PENDING_APPROVAL') {
        return 'Akun menunggu persetujuan admin. Coba lagi setelah disetujui.';
      }
      if (reason == 'DASHBOARD_ONLY_ROLE') {
        return 'Akun admin/supervisor hanya bisa masuk lewat dashboard web.';
      }
      return 'Akun dikunci sementara. Hubungi Kepegawaian.';
    }
    if (code == 409) return 'Perangkat ini sudah terdaftar pada akun lain.';
    return 'Gagal masuk (${code ?? 'tanpa kode'}).';
  }

  Widget _totpCard() {
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Verifikasi Dua Langkah',
            style: AppText.headlineSm.copyWith(color: AppColors.ink),
          ),
          const SizedBox(height: 4),
          Text(
            _useRecovery
                ? 'Masukkan salah satu kode pemulihan Anda. Kode yang dipakai langsung hangus.'
                : 'Buka aplikasi autentikator lalu masukkan kode 6 digit yang tampil.',
            style: AppText.bodyMd.copyWith(color: AppColors.inkSecondary),
          ),
          const SizedBox(height: 16),
          if (_useRecovery) ...[
            Text(
              'Kode Pemulihan *',
              style: AppText.labelMd.copyWith(color: AppColors.ink),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _recoveryCode,
              decoration: const InputDecoration(
                hintText: 'Contoh: XXXX-XXXXXX',
                prefixIcon: Icon(Icons.key_outlined),
              ),
              onSubmitted: (_) => _submitTotp(),
            ),
          ] else ...[
            Text(
              'Kode Autentikator *',
              style: AppText.labelMd.copyWith(color: AppColors.ink),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(
                hintText: '123456',
                prefixIcon: Icon(Icons.pin_outlined),
                counterText: '',
              ),
              onSubmitted: (_) => _submitTotp(),
            ),
          ],
          const SizedBox(height: 12),
          if (_error != null) ...[
            InfoBanner(_error!,
                tone: InfoBannerTone.error, title: 'Tidak dapat masuk'),
            const SizedBox(height: 16),
          ],
          SizedBox(
            width: double.infinity,
            height: AppColors.buttonHeight,
            child: FilledButton(
              onPressed: _busy ? null : _submitTotp,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _busy ? 'Memverifikasi...' : 'Verifikasi',
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
          const SizedBox(height: 4),
          Row(
            children: [
              TextButton(
                onPressed: _busy
                    ? null
                    : () {
                        setState(() {
                          _useRecovery = !_useRecovery;
                          _error = null;
                        });
                      },
                child: Text(
                  _useRecovery
                      ? 'Pakai kode autentikator'
                      : 'Pakai kode pemulihan',
                  style: AppText.labelMd.copyWith(color: AppColors.secondary),
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: _busy
                    ? null
                    : () {
                        setState(() {
                          _totpToken = null;
                          _code.clear();
                          _recoveryCode.clear();
                          _error = null;
                        });
                      },
                child: Text(
                  'Kembali',
                  style:
                      AppText.labelMd.copyWith(color: AppColors.inkSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[AppColors.surfaceLow, AppColors.canvas],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Container(
                height: 8,
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: <Color>[
                      AppColors.primary,
                      AppColors.primaryContainer,
                      AppColors.secondary,
                    ],
                  ),
                ),
              ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppColors.pageMargin,
                  vertical: 20,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const HospitalMark(size: 48),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    'Darmayu Face ID',
                                    style: AppText.headlineLg.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryFixed,
                                      borderRadius: BorderRadius.circular(
                                          AppColors.radiusFull),
                                    ),
                                    child: Text(
                                      'v2.4',
                                      style: AppText.labelSm.copyWith(
                                        color: AppColors.onPrimaryFixed,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                'Sistem Presensi & Verifikasi Nakes RSU Darmayu Madiun',
                                style: AppText.labelSm.copyWith(
                                  color: AppColors.inkSecondary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Selamat Datang',
                      style: AppText.displayMobile.copyWith(
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Silakan masuk dengan akun kredensial kepegawaian Anda untuk memulai dinas kerja.',
                      style: AppText.bodyMd.copyWith(
                        color: AppColors.inkSecondary,
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (_totpToken == null)
                      AppCard(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Email *',
                              style: AppText.labelMd
                                  .copyWith(color: AppColors.ink),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(
                                hintText: 'nama@rumahsakit.example',
                                prefixIcon: Icon(Icons.mail_outline),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(
                                  Icons.verified_user_outlined,
                                  size: 14,
                                  color: AppColors.inkSecondary,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    'Nomor Induk Pegawai terdaftar di Kepegawaian RS',
                                    style: AppText.labelSm.copyWith(
                                      color: AppColors.inkSecondary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Kata Sandi *',
                              style: AppText.labelMd
                                  .copyWith(color: AppColors.ink),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _password,
                              obscureText: _obscurePassword,
                              decoration: InputDecoration(
                                hintText: '••••••••••••',
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
                              onSubmitted: (_) => _submit(),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: Checkbox(
                                    value: _rememberMe,
                                    onChanged: (val) {
                                      setState(() {
                                        _rememberMe = val ?? true;
                                      });
                                    },
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Ingat Saya',
                                  style: AppText.bodyMd
                                      .copyWith(color: AppColors.ink),
                                ),
                                const Spacer(),
                                TextButton(
                                  onPressed: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Hubungi SIMRS & SDM Kepegawaian (Ext. 104) untuk reset kata sandi.',
                                        ),
                                      ),
                                    );
                                  },
                                  child: Text(
                                    'Lupa password?',
                                    style: AppText.labelMd.copyWith(
                                      color: AppColors.secondary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            if (_error != null) ...[
                              InfoBanner(
                                _error!,
                                tone: _error!.startsWith('Perangkat')
                                    ? InfoBannerTone.warning
                                    : InfoBannerTone.error,
                                title: 'Tidak dapat masuk',
                              ),
                              if (_unverifiedEmail != null)
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(
                                    onPressed: () {
                                      Navigator.of(context).push<void>(
                                        MaterialPageRoute<void>(
                                          builder: (_) => VerifyEmailScreen(
                                            email: _unverifiedEmail!,
                                            auth: widget.auth,
                                          ),
                                        ),
                                      );
                                    },
                                    icon: const Icon(Icons.mark_email_read,
                                        size: 18),
                                    label: const Text('Verifikasi email'),
                                  ),
                                ),
                              const SizedBox(height: 16),
                            ],
                            SizedBox(
                              width: double.infinity,
                              height: AppColors.buttonHeight,
                              child: FilledButton(
                                onPressed: _busy ? null : _submit,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      _busy ? 'Memverifikasi...' : 'Masuk',
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
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Belum punya akun?',
                                  style: AppText.labelSm.copyWith(
                                    color: AppColors.inkSecondary,
                                  ),
                                ),
                                TextButton(
                                  onPressed: _busy ? null : _openRegister,
                                  child: Text(
                                    'Daftar',
                                    style: AppText.labelMd.copyWith(
                                      color: AppColors.secondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    if (_totpToken != null) _totpCard(),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusCard),
                        border: Border.all(
                          color: AppColors.border,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceLowest,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: AppColors.border,
                              ),
                            ),
                            child: const Icon(
                              Icons.devices,
                              color: AppColors.secondary,
                              size: 18,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      'Keamanan Akun',
                                      style: AppText.labelMd
                                          .copyWith(color: AppColors.ink),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 1,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceContainer,
                                        borderRadius: BorderRadius.circular(
                                            AppColors.radiusFull),
                                      ),
                                      child: Text(
                                        'Multi-Perangkat',
                                        style: AppText.labelSm.copyWith(
                                          color: AppColors.onSecondaryContainer,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Perangkat ini didaftarkan otomatis untuk presensi. Anda tetap bisa masuk dari perangkat lain dengan akun yang sama.',
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
                    const SizedBox(height: 12),
                    const Center(
                      child: AppPill(
                        'Verifikasi Wajah Biometrik aktif',
                        AppColors.tealBadgeBg,
                        AppColors.tealBadgeText,
                        icon: Icons.face,
                        border: AppColors.tealBadgeBorder,
                      ),
                    ),
                    if (widget.servers != null) ...[
                      const SizedBox(height: 8),
                      Center(
                        child: ListenableBuilder(
                          listenable: widget.servers!,
                          builder: (BuildContext context, Widget? _) {
                            return TextButton.icon(
                              onPressed: _busy
                                  ? null
                                  : () => showServerSettingsDialog(
                                        context,
                                        widget.servers!,
                                      ),
                              icon: const Icon(
                                Icons.dns_outlined,
                                size: 16,
                                color: AppColors.inkSecondary,
                              ),
                              label: Text(
                                'Server: ${widget.servers!.hostLabel}',
                                style: AppText.labelSm.copyWith(
                                  color: AppColors.inkSecondary,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppColors.pageMargin, vertical: 10),
              decoration: const BoxDecoration(
                color: AppColors.surfaceLow,
                border: Border(
                  top: BorderSide(color: AppColors.border),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.help_outline,
                          size: 16, color: AppColors.inkSecondary),
                      const SizedBox(width: 4),
                      Text(
                        'Butuh bantuan aktivasi akun?',
                        style: AppText.labelSm.copyWith(
                          color: AppColors.inkSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  RichText(
                    text: TextSpan(
                      style: AppText.labelSm
                          .copyWith(color: AppColors.inkSecondary),
                      children: const [
                        TextSpan(text: 'Hubungi '),
                        TextSpan(
                          text: 'SIMRS & SDM Kepegawaian',
                          style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.ink),
                        ),
                        TextSpan(text: ' ('),
                        TextSpan(
                          text: 'Ext. 104',
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary),
                        ),
                        TextSpan(text: ')'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }
}
