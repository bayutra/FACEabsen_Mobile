import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/hospital_mark.dart';
import '../../../core/widgets/stitch.dart';
import '../data/auth_repository.dart';
import '../../device/data/device_repository.dart';
import '../../device/domain/device_models.dart';
import '../../device/presentation/device_register_screen.dart';
import '../../device/presentation/replacement_screen.dart';
import '../../device/presentation/replacement_status_screen.dart';

/// Stitch "Login Karyawan - Autentikasi" (design/stitch_rs_absen_mobile_app)
/// Clinical hospital authentication with automatic device binding.
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.auth,
    required this.devices,
    required this.onDone,
  });

  final AuthRepository auth;
  final DeviceRepository devices;
  final VoidCallback onDone;

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
  bool _busy = false;
  // Langkah kedua TOTP: diisi saat login melempar TotpChallengeException.
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
        _busy = false;
      });
    } catch (e) {
      // Non-Dio throwables (parse/state bugs, never server verdicts).
      // Logged in debug builds only — the message below stays generic and
      // carries no request data.
      if (kDebugMode) debugPrint('login failed: $e');
      if (!mounted) return;
      setState(() {
        _error = 'Terjadi kesalahan sistem. Silakan coba lagi.';
        _busy = false;
      });
    }
  }

  /// Jalur pasca-login bersama: registrasi perangkat lalu [onDone].
  /// Dipakai persis sama oleh login langsung maupun penyelesaian TOTP.
  /// Perangkat yang belum aktif tidak lagi berhenti di banner error —
  /// user dibawa ke layar Daftarkan Perangkat (langkah 2 dari 3) yang
  /// menampilkan status nyata dari server.
  Future<void> _finishSession() async {
    final BoundDevice device = await widget.devices.register();
    if (!mounted) return;
    if (device.status != DeviceStatus.active) {
      setState(() => _busy = false);
      await _openPendingDevice(device);
      return;
    }
    widget.onDone();
  }

  Future<void> _openPendingDevice(BoundDevice device) async {
    final String rawId = device.installationId.isEmpty
        ? device.id
        : device.installationId;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => DeviceRegisterScreen(
          deviceName: device.deviceName?.isNotEmpty == true
              ? device.deviceName!
              : 'Perangkat ini',
          deviceModel: device.platform.isEmpty ? '—' : device.platform,
          osLabel: device.appVersion?.isNotEmpty == true
              ? '${device.platform} • v${device.appVersion}'
              : (device.platform.isEmpty ? '—' : device.platform),
          deviceId: shortDeviceId(rawId),
          ownerName: _email.text.trim().isEmpty ? '—' : _email.text.trim(),
          onContinue: () => _recheckPending(device.id),
          onRequestReplacement: () => _openReplacementRequest(device.id),
          onUseOther: () {
            Navigator.of(context).pop();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                    'Masuk dari perangkat lain bila tersedia. Perangkat ini tetap menunggu aktivasi.'),
              ),
            );
          },
        ),
      ),
    );
  }

  /// Dari layar Daftarkan Perangkat: ajukan HP PENDING ini sebagai pengganti
  /// perangkat aktif lama. Butuh password + persetujuan admin di web.
  /// Setelah disetujui, tombol Lanjutkan di layar register meloloskan user.
  Future<void> _openReplacementRequest(String pendingDeviceId) async {
    final ChangeRequest? created = await Navigator.of(context).push<ChangeRequest>(
      MaterialPageRoute(
        builder: (_) => ReplacementScreen(
          devices: widget.devices,
          newDeviceId: pendingDeviceId,
        ),
      ),
    );
    if (created == null || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Pengajuan terkirim. Menunggu persetujuan admin.')),
    );
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReplacementStatusScreen(
          request: created,
          devices: widget.devices,
        ),
      ),
    );
  }

  /// Cek ulang status ke server: hanya lanjut bila admin sudah
  /// mengaktifkan — tidak pernah mengarang status aktif.
  Future<void> _recheckPending(String deviceId) async {
    try {
      final String? currentId = await widget.devices.currentDeviceId();
      final List<BoundDevice> all = await widget.devices.myDevices();
      BoundDevice? now;
      for (final BoundDevice d in all) {
        if (d.id == (currentId ?? deviceId)) now = d;
      }
      if (!mounted) return;
      if (now?.status == DeviceStatus.active) {
        Navigator.of(context).pop();
        widget.onDone();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Perangkat masih ${deviceStatusLabel(now?.status ?? DeviceStatus.pending)}. Minta aktivasi admin SIMRS.'),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gagal memeriksa status. Periksa koneksi.')),
      );
    }
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

  String _messageFor(DioException e) {
    final int? code = e.response?.statusCode;
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Server tidak terjangkau. Periksa koneksi jaringan rumah sakit.';
    }
    if (code == 401) return 'Kredensial atau kata sandi tidak sesuai.';
    if (code == 403) return 'Akun dikunci sementara. Hubungi Kepegawaian.';
    if (code == 409) return 'Perangkat ini sudah terdaftar pada akun lain.';
    return 'Gagal masuk (${code ?? 'tanpa kode'}).';
  }

  /// Kartu langkah kedua TOTP: kode autentikator + alih kode pemulihan.
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
            InfoBanner(_error!, tone: InfoBannerTone.error, title: 'Tidak dapat masuk'),
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
                  const Icon(Icons.arrow_forward, size: 20, color: Colors.white),
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
                  _useRecovery ? 'Pakai kode autentikator' : 'Pakai kode pemulihan',
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
                  style: AppText.labelMd.copyWith(color: AppColors.inkSecondary),
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
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // Top Medical Accent Bar — spec h-6px primary→primaryContainer→secondaryContainer
            Container(
              height: 6,
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primary,
                    AppColors.primaryContainer,
                    AppColors.secondaryContainer,
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
                    // Hospital Branding Header
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
                                    'RS Absen',
                                    style: AppText.headlineSm.copyWith(
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
                                      borderRadius: BorderRadius.circular(AppColors.radiusFull),
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

                    // Welcome Text
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

                    // Credential Form Card
                    if (_totpToken == null)
                    AppCard(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Email *',
                            style: AppText.labelMd.copyWith(color: AppColors.ink),
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
                            style: AppText.labelMd.copyWith(color: AppColors.ink),
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
                                style: AppText.bodyMd.copyWith(color: AppColors.ink),
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
                                  const Icon(Icons.arrow_forward, size: 20, color: Colors.white),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_totpToken != null) _totpCard(),
                    const SizedBox(height: 16),

                    // Security Notice Card: Device Binding
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(AppColors.radiusCard),
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
                                      style: AppText.labelMd.copyWith(color: AppColors.ink),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 1,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceContainer,
                                        borderRadius: BorderRadius.circular(AppColors.radiusFull),
                                      ),
                                      child: Text(
                                        '1 Nakes = 1 HP',
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
                                  'Perangkat ini akan didaftarkan sebagai perangkat absensi utama Anda untuk mencegah duplikasi presensi.',
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

                    // Biometric quick badge — spec pill face aktif
                    const Center(
                      child: AppPill(
                        'Verifikasi Wajah Biometrik aktif',
                        AppColors.tealBadgeBg,
                        AppColors.tealBadgeText,
                        icon: Icons.face,
                        border: AppColors.tealBadgeBorder,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Sticky footer
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppColors.pageMargin, vertical: 10),
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
                      const Icon(Icons.help_outline, size: 16, color: AppColors.inkSecondary),
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
                      style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                      children: const [
                        TextSpan(text: 'Hubungi '),
                        TextSpan(
                          text: 'SIMRS & SDM Kepegawaian',
                          style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
                        ),
                        TextSpan(text: ' ('),
                        TextSpan(
                          text: 'Ext. 104',
                          style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
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
    );
  }
}
