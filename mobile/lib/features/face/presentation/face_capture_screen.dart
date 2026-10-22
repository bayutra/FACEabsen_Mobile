import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../data/face_repository.dart';
import '../domain/face_quality.dart';
import 'face_guidance_card.dart';
import 'face_scan_issue_screen.dart';

class FaceCaptureScreen extends StatefulWidget {
  const FaceCaptureScreen({super.key, required this.faces});

  final FaceRepository faces;

  @override
  State<FaceCaptureScreen> createState() => _FaceCaptureScreenState();
}

class _FaceCaptureScreenState extends State<FaceCaptureScreen>
    with WidgetsBindingObserver {
  CameraController? _controller;
  String? _error;
  bool _busy = false;

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
      setState(() => _error = null);
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    try {
      final List<CameraDescription> cams = await availableCameras();
      if (!mounted) return;
      if (cams.isEmpty) {
        setState(() => _error = 'Tidak ada kamera yang tersedia.');
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
      setState(() => _error = e.code == 'CameraAccessDenied'
          ? 'Izin kamera ditolak. Aktifkan di Pengaturan HP.'
          : 'Kamera gagal dibuka (${e.code}).');
    } catch (_) {
      if (mounted) setState(() => _error = 'Kamera gagal dibuka.');
    }
  }

  Future<void> _capture() async {
    final CameraController? controller = _controller;
    if (controller == null || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _failGate = null;
    });
    try {
      final XFile shot = await controller.takePicture();
      final FaceCapture? capture =
          await widget.faces.captureEmbedding(shot.path);
      if (!mounted) return;
      if (capture == null) {
        final String message = await widget.faces.rejectionMessage(shot.path);
        final FaceGate? gate = await widget.faces.rejectionGate(shot.path);
        if (!mounted) return;
        setState(() {
          _error = message;
          _failGate = (gate != null && gate != FaceGate.ok) ? gate : null;
          _busy = false;
        });
        return;
      }
      if (mounted) Navigator.of(context).pop(capture);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memproses wajah.';
        _busy = false;
      });
    }
  }

  Future<void> _openIssueGuide(FaceGate gate) async {
    final bool? retry = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => FaceScanIssueScreen(
          gate: gate,
          message: _error,
          onRetry: () => Navigator.of(context).pop(true),
          onHelp: () => Navigator.of(context).pop(false),
        ),
      ),
    );
    if (!mounted) return;
    if (retry == false) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Hubungi Helpdesk SIMRS Ext. 104 untuk verifikasi manual.'),
        ),
      );
    }
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
      appBar: AppBar(title: const Text('Verifikasi Wajah')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 3 / 4,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.ink,
                  borderRadius: BorderRadius.circular(AppColors.radiusCard),
                ),
                clipBehavior: Clip.antiAlias,
                child: _error != null && controller == null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(_error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white)),
                        ),
                      )
                    : controller == null
                        ? const Center(
                            child:
                                CircularProgressIndicator(color: Colors.white))
                        : Stack(
                            fit: StackFit.expand,
                            children: [
                              CameraPreview(controller),
                              const CustomPaint(painter: _CaptureOval()),
                              const Align(
                                alignment: Alignment.topCenter,
                                child: Padding(
                                  padding: EdgeInsets.only(top: 16),
                                  child: Text(
                                    'Posisikan wajah di dalam lingkaran',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ),
                            ],
                          ),
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null && controller != null)
              _failGate != null
                  ? Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          FaceGuidanceCard(
                            gate: _failGate!,
                            message: _error!,
                            onRetry: _capture,
                          ),
                          TextButton.icon(
                            onPressed: () => _openIssueGuide(_failGate!),
                            icon: const Icon(Icons.troubleshoot_outlined,
                                size: 18),
                            label: const Text('Buka panduan perbaikan'),
                          ),
                        ],
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              color: AppColors.errorText, fontSize: 14)),
                    ),
            FilledButton(
              onPressed: (controller == null || _busy) ? null : _capture,
              child: Text(_busy ? 'Memproses…' : 'Ambil wajah'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CaptureOval extends CustomPainter {
  const _CaptureOval();

  @override
  void paint(Canvas canvas, Size size) {
    final Rect oval = Rect.fromCenter(
      center: size.center(Offset.zero),
      width: size.width * 0.72,
      height: size.height * 0.52,
    );
    canvas.drawPath(
      Path()
        ..addOval(oval)
        ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
        ..fillType = PathFillType.evenOdd,
      Paint()..color = const Color(0x730F172A),
    );
    canvas.drawOval(
        oval,
        Paint()
          ..color = AppColors.interactive
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
