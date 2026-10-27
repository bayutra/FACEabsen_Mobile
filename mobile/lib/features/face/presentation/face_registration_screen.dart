import 'package:camera/camera.dart';
// ignore_for_file: empty_catches
import 'package:flutter/material.dart';

import '../../../core/network/error_detail.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../data/face_repository.dart';
import '../domain/face_quality.dart';
import '../domain/privacy_notice.dart';
import 'face_guidance_card.dart';
import 'face_registered_screen.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../device/data/device_repository.dart';

class FaceRegistrationScreen extends StatefulWidget {
  const FaceRegistrationScreen({
    super.key,
    required this.faces,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
    this.attendance,
    this.devices,
  });

  final FaceRepository faces;

  final String displayName;
  final String employeeNo;

  final AttendanceRepository? attendance;
  final DeviceRepository? devices;

  @override
  State<FaceRegistrationScreen> createState() => _FaceRegistrationScreenState();
}

class _FaceRegistrationScreenState extends State<FaceRegistrationScreen>
    with WidgetsBindingObserver {
  CameraController? _controller;
  String? _initError;
  bool _busy = false;
  String? _message;
  bool _success = false;
  bool _consented = false;
  bool _noticeRead = false;
  String? _noticeVersion;
  bool _useScreenFlash = false;
  bool _flashOverlay = false;

  FaceGate? _failGate;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      final CameraController? controller = _controller;
      _controller = null;
      controller?.dispose();
      if (mounted) setState(() {});
    } else if (state == AppLifecycleState.resumed) {
      if (_controller != null || !mounted) return;
      setState(() => _initError = null);
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    try {
      final List<CameraDescription> cams = await availableCameras();
      if (!mounted) return;
      if (cams.isEmpty) {
        setState(() => _initError = 'Tidak ada kamera yang tersedia.');
        return;
      }
      final CameraDescription front = cams.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cams.first,
      );
      final CameraController controller = CameraController(
        front,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await controller.initialize();

      try {
        await controller.setFlashMode(FlashMode.off);
      } on CameraException {}
      if (mounted) setState(() => _controller = controller);
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(() => _initError = e.code == 'CameraAccessDenied'
          ? 'Izin kamera ditolak. Aktifkan di Pengaturan HP.'
          : 'Kamera gagal dibuka (${e.code}).');
    } catch (_) {
      if (mounted) setState(() => _initError = 'Kamera gagal dibuka.');
    }
  }

  Future<void> _capture() async {
    final CameraController? controller = _controller;
    if (controller == null || _busy) return;
    if (!_consented) {
      setState(() => _message = 'Centang persetujuan privasi terlebih dahulu.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
      _success = false;
      _failGate = null;
    });
    try {
      if (_useScreenFlash) {
        setState(() => _flashOverlay = true);
        await Future.delayed(const Duration(milliseconds: 250));
        if (!mounted) return;
      }
      final XFile shot = await controller.takePicture();
      if (_useScreenFlash && mounted) setState(() => _flashOverlay = false);
      final FaceResult result = await widget.faces.registerFromFile(
        shot.path,
        noticeVersion: _noticeVersion,
      );
      if (!mounted) return;
      setState(() {
        _message = result.message +
            (result.score != null
                ? ' (skor ${(result.score! * 100).round()}%)'
                : '');
        _success = result.ok;

        _failGate =
            (!result.ok && result.gate != null && result.gate != FaceGate.ok)
                ? result.gate
                : null;
        _busy = false;
      });

      if (result.ok) {
        final AttendanceRepository? att = widget.attendance;
        final DeviceRepository? dev = widget.devices;
        if (att == null || dev == null) return;
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => FaceRegisteredScreen(
              version: result.version ?? 1,
              qualityScore: result.score ?? 0,
              employeeNo: widget.employeeNo,
              displayName: widget.displayName,
              registeredAt: DateTime.now(),
              attendance: att,
              faces: widget.faces,
              devices: dev,
            ),
          ),
        );
        if (mounted) setState(() => _message = null);
      }
    } catch (e) {
      if (mounted) setState(() => _flashOverlay = false);
      if (!mounted) return;
      setState(() {
        _message =
            'Gagal memproses. Periksa koneksi server. (${describeError(e)})';
        _busy = false;
      });
    }
  }

  Future<void> _showNotice() async {
    final PrivacyNotice notice = await widget.faces.fetchNotice();
    if (!mounted) return;
    setState(() {
      _noticeRead = true;
      _noticeVersion = notice.version;
    });
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(notice.title),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Versi ${notice.version}',
                  style: const TextStyle(
                      color: AppColors.inkSecondary, fontSize: 12)),
              const SizedBox(height: 8),
              Text(notice.body, style: const TextStyle(fontSize: 14)),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Tutup')),
        ],
      ),
    );
  }

  void _toggleConsent(bool? value) {
    if ((value ?? false) && !_noticeRead) {
      setState(() =>
          _message = 'Baca pemberitahuan privasi terlebih dahulu.');
      return;
    }
    setState(() => _consented = value ?? false);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final CameraController? controller = _controller;
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: StitchHeader(
        title: 'Registrasi Wajah',
        subtitle: 'Biometrik Shift • Perekaman Wajah',
        onBack: () => Navigator.of(context).maybePop(),
        trailing: const AppPill(
          'Perekaman',
          AppColors.tealBadgeBg,
          AppColors.tealBadgeText,
          icon: Icons.face_retouching_natural,
          border: AppColors.tealBadgeBorder,
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          _cameraCard(controller),
          const SizedBox(height: 12),
          const InfoBanner(
            'Foto wajah tidak dikirim ke server. Perangkat hanya mengirim '
            'template biometrik terenkripsi untuk verifikasi presensi.',
            title: 'Registrasi Wajah Baru',
            tone: InfoBannerTone.info,
          ),
          const SizedBox(height: 12),
          _guidanceCard(),
          const SizedBox(height: 12),
          _lightingCard(),
          const SizedBox(height: 12),
          _consentCard(),
          if (_message != null) ...<Widget>[
            const SizedBox(height: 12),
            if (_failGate != null)
              FaceGuidanceCard(
                gate: _failGate!,
                message: _message!,
                onRetry: _capture,
              )
            else
              InfoBanner(
                _message!,
                title: _success
                    ? 'Pendaftaran berhasil'
                    : 'Perekaman belum berhasil',
                tone: _success ? InfoBannerTone.success : InfoBannerTone.error,
              ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            height: AppColors.buttonHeight,
            child: FilledButton.icon(
              onPressed: (controller == null || _busy) ? null : _capture,
              icon: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.photo_camera_outlined, size: 20),
              label: Text(_busy ? 'Memproses…' : 'Ambil & Daftarkan Wajah'),
            ),
          ),
          if (_success) ...<Widget>[
            const SizedBox(height: 8),
            SizedBox(
              height: AppColors.ghostHeight,
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Selesai'),
              ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              const Icon(Icons.shield_outlined,
                  size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  'Data biometrik dilindungi sesuai Permenkes RI',
                  textAlign: TextAlign.center,
                  style: AppText.labelSm
                      .copyWith(color: AppColors.inkSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _cameraCard(CameraController? controller) {
    final Color frameColor = _success
        ? AppColors.success
        : (_failGate != null ? AppColors.roseFill : AppColors.scanner);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppColors.radiusHero),
        border: Border.all(color: frameColor, width: 3),
        boxShadow: <BoxShadow>[
          BoxShadow(color: frameColor.withOpacity(0.2), blurRadius: 16),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppColors.radiusCard),
        child: AspectRatio(
          aspectRatio: 4 / 4.3,
          child: Container(
            color: AppColors.ink,
            child: Stack(
              fit: StackFit.expand,
              children: <Widget>[
                if (controller != null && controller.value.isInitialized)
                  FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: controller.value.previewSize?.height ?? 1,
                      height: controller.value.previewSize?.width ?? 1,
                      child: CameraPreview(controller),
                    ),
                  )
                else if (_initError != null)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _initError!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                  )
                else
                  const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.primaryFixed),
                  ),
                CustomPaint(
                  painter: _RegistrationHudPainter(
                    color: _success ? AppColors.success : AppColors.scanner,
                  ),
                ),
                if (_flashOverlay)
                  Positioned.fill(
                    child: Container(color: Colors.white.withOpacity(0.85)),
                  ),
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.inverseSurface.withOpacity(0.85),
                      borderRadius:
                          BorderRadius.circular(AppColors.radiusFull),
                      border: Border.all(
                          color: AppColors.primaryFixed.withOpacity(0.4)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Icon(Icons.verified_user_outlined,
                            size: 12, color: AppColors.primaryFixed),
                        SizedBox(width: 5),
                        Text(
                          'Registrasi Wajah',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: Tooltip(
                    message: _useScreenFlash
                        ? 'Matikan cahaya layar'
                        : 'Nyalakan cahaya layar (mode gelap)',
                    child: Material(
                      color: _useScreenFlash
                          ? AppColors.primaryFixed
                          : Colors.black.withOpacity(0.45),
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _busy
                            ? null
                            : () => setState(
                                  () => _useScreenFlash = !_useScreenFlash,
                                ),
                        child: Padding(
                          padding: const EdgeInsets.all(9),
                          child: Icon(
                            _useScreenFlash
                                ? Icons.flash_on
                                : Icons.flash_off,
                            size: 18,
                            color: _useScreenFlash
                                ? AppColors.inverseSurface
                                : Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withOpacity(0.9),
                      borderRadius:
                          BorderRadius.circular(AppColors.radiusFull),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: <Widget>[
                        Icon(Icons.center_focus_strong,
                            size: 13, color: Colors.white),
                        SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            'Posisikan wajah di bingkai • mata terbuka',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _guidanceCard() => const AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(Icons.fact_check_outlined,
                    size: 18, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Panduan Perekaman',
                    style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            SizedBox(height: 10),
            _GuideRow(
              icon: Icons.visibility_outlined,
              title: 'Mata terbuka & wajah terlihat',
              detail: 'Lepas masker atau penutup wajah sementara saat merekam.',
            ),
            _GuideRow(
              icon: Icons.light_mode_outlined,
              title: 'Pencahayaan merata',
              detail: 'Hindari cahaya langsung ke kamera dan bayangan di wajah.',
            ),
            _GuideRow(
              icon: Icons.straighten,
              title: 'Jarak ideal ± 45 cm',
              detail: 'Pegang ponsel stabil setinggi wajah, tanpa gerakan cepat.',
            ),
          ],
        ),
      );

  Widget _lightingCard() => AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: <Widget>[
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(AppColors.radiusInput),
              ),
              child: const Icon(Icons.light_mode_outlined,
                  size: 20, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Cahaya layar (mode gelap)',
                    style:
                        TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Layar berkilat sebentar sebelum capture untuk menerangi '
                    'wajah di ruangan redup.',
                    style:
                        TextStyle(fontSize: 11, color: AppColors.inkSecondary),
                  ),
                ],
              ),
            ),
            Switch(
              value: _useScreenFlash,
              activeTrackColor: AppColors.primaryContainer,
              onChanged:
                  _busy ? null : (bool v) => setState(() => _useScreenFlash = v),
            ),
          ],
        ),
      );

  Widget _consentCard() => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Row(
              children: <Widget>[
                Icon(Icons.privacy_tip_outlined,
                    size: 18, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Persetujuan Privasi',
                    style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: _busy ? null : () => _toggleConsent(!_consented),
              borderRadius: BorderRadius.circular(AppColors.radiusInput),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Checkbox(
                    value: _consented,
                    onChanged: _busy ? null : _toggleConsent,
                  ),
                  const SizedBox(width: 4),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'Saya setuju data wajah saya diproses untuk presensi '
                        'di RSU Darmayu Madiun.',
                        style: TextStyle(fontSize: 13, height: 1.45),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _showNotice,
                icon: const Icon(Icons.description_outlined, size: 16),
                label: const Text('Baca pemberitahuan privasi'),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 36),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ),
      );
}

class _GuideRow extends StatelessWidget {
  const _GuideRow({
    required this.icon,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: AppColors.tealBadgeText),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    style: const TextStyle(
                        fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    detail,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.inkSecondary,
                        height: 1.45),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

/// Registration guides: scanner brackets plus the oval face target.
class _RegistrationHudPainter extends CustomPainter {
  const _RegistrationHudPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.46),
      width: size.width * 0.64,
      height: size.height * 0.62,
    );
    canvas.drawOval(
      oval,
      Paint()
        ..color = color.withOpacity(0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6,
    );

    final Paint bracket = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    const double inset = 16;
    const double length = 26;
    final double right = size.width - inset;
    final double bottom = size.height - inset;
    for (final (Offset start, Offset end) in <(Offset, Offset)>[
      (const Offset(inset, inset), const Offset(inset + length, inset)),
      (const Offset(inset, inset), const Offset(inset, inset + length)),
      (Offset(right, inset), Offset(right - length, inset)),
      (Offset(right, inset), Offset(right, inset + length)),
      (Offset(inset, bottom), Offset(inset + length, bottom)),
      (Offset(inset, bottom), Offset(inset, bottom - length)),
      (Offset(right, bottom), Offset(right - length, bottom)),
      (Offset(right, bottom), Offset(right, bottom - length)),
    ]) {
      canvas.drawLine(start, end, bracket);
    }
  }

  @override
  bool shouldRepaint(covariant _RegistrationHudPainter oldDelegate) =>
      oldDelegate.color != color;
}
