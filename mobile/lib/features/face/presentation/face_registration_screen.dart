import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../core/network/error_detail.dart';
import '../../../core/theme/app_colors.dart';
import '../data/face_repository.dart';
import '../domain/face_quality.dart';
import '../domain/privacy_notice.dart';
import 'face_guidance_card.dart';
import 'face_registered_screen.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../device/data/device_repository.dart';

/// STEP 9 face registration (Stitch "Pendaftaran Wajah"): camera viewport
/// with guide overlay, quality-gated capture, server upload of embedding only.
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

  /// Identity shown on the confirmation receipt.
  final String displayName;
  final String employeeNo;

  /// Optional dependencies for the post-registration "Mulai Presensi" shortcut.
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

  /// Real failing quality gate for the last shot (null = no failure or a
  /// non-capture error). Drives the guidance card; never a guessed diagnosis.
  FaceGate? _failGate;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Same dead-preview hazard as the verify screen: release on background,
    // rebuild + clear the stale error on resume.
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
      // Default AUTO memicu Retina Flash (kamera depan iOS) saat menangkap
      // frame; matikan agar pemindaian tidak berkedip menyilaukan.
      try {
        await controller.setFlashMode(FlashMode.off);
      } on CameraException {
        // Perangkat tanpa lampu kilat.
      }
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
        // Guidance card only for real quality-gate failures; server/network
        // failures (gate null/ok) keep the bare message.
        _failGate =
            (!result.ok && result.gate != null && result.gate != FaceGate.ok)
                ? result.gate
                : null;
        _busy = false;
      });
      // Stitch "Pendaftaran Wajah - Berhasil": a dedicated confirmation screen.
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
      appBar: AppBar(title: const Text('Pendaftaran Wajah')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 4 / 4.2,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 240),
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: _success ? AppColors.success : AppColors.scanner,
                    width: 3,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: (_success ? AppColors.success : AppColors.scanner)
                          .withOpacity(0.22),
                      blurRadius: 16,
                    ),
                  ],
                ),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.ink,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _initError != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(_initError!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Colors.white)),
                          ),
                        )
                      : controller == null
                          ? const Center(
                              child: CircularProgressIndicator(
                                  color: Colors.white))
                          : Stack(
                              fit: StackFit.expand,
                              children: [
                                CameraPreview(controller),
                                const CustomPaint(painter: _CameraFrameGuide()),
                                if (_flashOverlay)
                                  Positioned.fill(
                                    child: Container(
                                        color: Colors.white.withOpacity(0.85)),
                                  ),
                                // Badge status registrasi
                                Align(
                                  alignment: Alignment.topCenter,
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.inverseSurface
                                            .withOpacity(0.85),
                                        borderRadius: BorderRadius.circular(
                                            AppColors.radiusFull),
                                        border: Border.all(
                                          color: AppColors.primaryFixed
                                              .withOpacity(0.4),
                                        ),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.verified_user_outlined,
                                              size: 12,
                                              color: Color(0xFF89F5E7)),
                                          SizedBox(width: 5),
                                          Text(
                                            'Registrasi Wajah',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                                // Tombol cahaya layar (flood illuminator analog)
                                Align(
                                  alignment: Alignment.topRight,
                                  child: Padding(
                                    padding:
                                        const EdgeInsets.only(top: 8, right: 8),
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
                                                    () => _useScreenFlash =
                                                        !_useScreenFlash,
                                                  ),
                                          child: Padding(
                                            padding: const EdgeInsets.all(8),
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
                                ),
                                const Align(
                                  alignment: Alignment.bottomCenter,
                                  child: Padding(
                                    padding: EdgeInsets.only(bottom: 12),
                                    child: Text(
                                      'Posisikan wajah di dalam bingkai • mata terbuka',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Switch(
                  value: _useScreenFlash,
                  onChanged:
                      _busy ? null : (v) => setState(() => _useScreenFlash = v),
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Gunakan cahaya layar (mode gelap) — layar akan '
                    'berkilat sebentar sebelum capture untuk menerangi wajah.',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: _consented,
                  onChanged: (v) {
                    if ((v ?? false) && !_noticeRead) {
                      setState(() => _message =
                          'Baca pemberitahuan privasi terlebih dahulu.');
                      return;
                    }
                    setState(() => _consented = v ?? false);
                  },
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Saya setuju data wajah saya diproses untuk presensi.',
                        style: TextStyle(fontSize: 14),
                      ),
                      TextButton(
                        onPressed: _showNotice,
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text('Baca pemberitahuan privasi'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_message != null)
              _failGate != null
                  ? Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: FaceGuidanceCard(
                        gate: _failGate!,
                        message: _message!,
                        onRetry: _capture,
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _message!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: _success
                              ? AppColors.successText
                              : AppColors.errorText,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
            FilledButton(
              onPressed: (controller == null || _busy) ? null : _capture,
              child: Text(_busy ? 'Memproses…' : 'Ambil & Daftarkan Wajah'),
            ),
            if (_success)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Selesai'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Rounded-square face framing guide for the registration camera.
class _CameraFrameGuide extends CustomPainter {
  const _CameraFrameGuide();

  @override
  void paint(Canvas canvas, Size size) {
    final double side = size.shortestSide * 0.82;
    final Rect frame = Rect.fromCenter(
      center: size.center(Offset.zero),
      width: side,
      height: side,
    );
    final RRect roundedFrame = RRect.fromRectAndRadius(
      frame,
      const Radius.circular(24),
    );
    // Keep the camera visible inside a square target and dim the surrounding preview.
    canvas.drawPath(
      Path()
        ..addRRect(roundedFrame)
        ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
        ..fillType = PathFillType.evenOdd,
      Paint()..color = const Color(0x730F172A),
    );
    const double cornerLength = 24;
    final Paint p = Paint()
      ..color = AppColors.scanner
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    canvas.drawRRect(roundedFrame, p);
    for (final (Offset start, Offset end) in <(Offset, Offset)>[
      (frame.topLeft, Offset(frame.left + cornerLength, frame.top)),
      (frame.topLeft, Offset(frame.left, frame.top + cornerLength)),
      (frame.topRight, Offset(frame.right - cornerLength, frame.top)),
      (frame.topRight, Offset(frame.right, frame.top + cornerLength)),
      (frame.bottomLeft, Offset(frame.left + cornerLength, frame.bottom)),
      (frame.bottomLeft, Offset(frame.left, frame.bottom - cornerLength)),
      (frame.bottomRight, Offset(frame.right - cornerLength, frame.bottom)),
      (frame.bottomRight, Offset(frame.right, frame.bottom - cornerLength)),
    ]) {
      canvas.drawLine(start, end, p);
    }
  }

  @override
  bool shouldRepaint(covariant _CameraFrameGuide oldDelegate) => false;
}
