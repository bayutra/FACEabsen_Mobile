import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;

import '../../../core/theme/app_colors.dart';
import '../domain/eye_geometry.dart';
import '../domain/passive_liveness.dart';
import '../../face/data/face_detector.dart';
import '../../face/data/face_repository.dart';
import 'liveness_screen.dart' show contourOf;

class PassiveScanScreen extends StatefulWidget {
  const PassiveScanScreen({
    super.key,
    required this.faces,
    this.displayName = 'Karyawan',
  });

  final FaceRepository faces;
  final String displayName;

  @override
  State<PassiveScanScreen> createState() => _PassiveScanScreenState();
}

class _PassiveScanScreenState extends State<PassiveScanScreen>
    with WidgetsBindingObserver {
  CameraController? _controller;
  late final FaceDetectorService _detector;
  late final PassiveLiveness _liveness;
  Timer? _timer;

  String? _error;
  String? _hint;

  static const int _blankLimit = 8;

  bool _processing = false;
  bool _passed = false;
  List<double>? _embedding;
  int _blankFrames = 0;
  double _progress = 0;
  double _relativeFaceWidth = 0;

  static const Duration _timeout = Duration(seconds: 20);
  DateTime _startedAt = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    final bool needsContours = defaultTargetPlatform == TargetPlatform.iOS;
    _detector = FaceDetectorService(
      classification: true,
      contours: needsContours,
      landmarks: true,
      performanceMode: FaceDetectorMode.fast,
      minFaceSize: 0.10,
      onError: _onDetectorError,
    );
    _liveness = PassiveLiveness();
    _startedAt = DateTime.now();
    _initCamera();
  }

  void _onDetectorError(String message) {
    _timer?.cancel();
    if (mounted) setState(() => _error = message);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _timer?.cancel();
      _timer = null;
      final CameraController? controller = _controller;
      _controller = null;
      controller?.dispose();
      _processing = false;
      if (mounted) setState(() {});
    } else if (state == AppLifecycleState.resumed) {
      if (!mounted || _controller != null || _passed) return;
      setState(() {
        _error = null;
        _hint = null;
        _progress = 0;
        _relativeFaceWidth = 0;
        _embedding = null;
        _blankFrames = 0;
        _startedAt = DateTime.now();
        _liveness.reset();
      });
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
        imageFormatGroup: ImageFormatGroup.nv21,
      );
      await controller.initialize();

      try {
        await controller.setFlashMode(FlashMode.off);
      } on CameraException {}
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() => _controller = controller);
      _timer =
          Timer.periodic(const Duration(milliseconds: 400), (_) => _tick());
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.code == 'CameraAccessDenied'
          ? 'Izin kamera ditolak. Aktifkan di Pengaturan HP.'
          : 'Kamera gagal dibuka (${e.code}).');
    } catch (_) {
      if (mounted) setState(() => _error = 'Kamera gagal dibuka.');
    }
  }

  Future<void> _tick() async {
    final CameraController? controller = _controller;
    if (controller == null || _processing || _passed) return;
    if (DateTime.now().difference(_startedAt) > _timeout) {
      _timer?.cancel();
      if (mounted) {
        setState(() => _error =
            'Waktu habis. Pastikan wajah terlihat jelas dan Anda tidak memegang foto.');
      }
      return;
    }
    _processing = true;
    String? shotPath;
    try {
      final XFile shot = await controller.takePicture();
      shotPath = shot.path;
      final List<Face> faces = await _detector.detect(shot.path);
      if (!mounted) return;

      PassiveFrame frame;
      if (faces.length != 1) {
        frame = PassiveFrame(faceCount: faces.length, relativeWidth: 0);

        _blankFrames++;
        if (_blankFrames == _blankLimit) {
          _onDetectorError(
            'Wajah tidak terdeteksi pada $_blankLimit frame berturut-turut. '
            'Pastikan izin kamera sudah diberikan, lensa kamera tidak tertutup, '
            'dan pencahayaan cukup.',
          );
          return;
        }
      } else {
        final Face f = faces.single;

        final Uint8List bytes = await File(shot.path).readAsBytes();
        if (!mounted) return;
        final img.Decoder? decoder = img.findDecoderForData(bytes);
        final img.DecodeInfo? info = decoder?.startDecode(bytes);
        if (info == null || info.width <= 0) return;
        final double rel = f.boundingBox.width / info.width;

        final double? leftProb = f.leftEyeOpenProbability;
        final double? rightProb = f.rightEyeOpenProbability;
        final bool hasProbability = leftProb != null && rightProb != null;

        final FaceLandmark? nose = f.landmarks[FaceLandmarkType.noseBase];
        final double? noseX = nose?.position.x.toDouble();
        final double? noseY = nose?.position.y.toDouble();

        _blankFrames = 0;
        frame = PassiveFrame(
          faceCount: 1,
          relativeWidth: rel,
          yaw: f.headEulerAngleY,
          eyeOpenLeft: hasProbability
              ? leftProb
              : eyeOpenRatioFromLandmarks(
                  contourOf(f, FaceContourType.leftEye)),
          eyeOpenRight: hasProbability
              ? rightProb
              : eyeOpenRatioFromLandmarks(
                  contourOf(f, FaceContourType.rightEye)),
          landmarkX: noseX,
          landmarkY: noseY,
        );
        if (mounted) setState(() => _relativeFaceWidth = rel);
      }

      final PassiveLivenessResult result = _liveness.add(frame);
      if (!mounted) return;
      setState(() {
        _progress = result.progress;
        _hint = result.rejection?.message ?? result.hint;
      });

      if (result.verdict == PassiveVerdict.passed) {
        final FaceCapture? capture =
            await widget.faces.captureEmbedding(shot.path);
        if (capture == null) {
          if (mounted) {
            setState(() =>
                _hint = 'Wajah kurang jelas. Dekatkan sedikit dan coba lagi.');
          }
          _liveness.reset();
          return;
        }
        _embedding = capture.embedding;
        await _finish();
      }
    } catch (_) {
    } finally {
      _processing = false;
      if (shotPath != null) {
        try {
          await File(shotPath).delete();
        } catch (_) {}
      }
    }
  }

  Future<void> _finish() async {
    if (!mounted) return;
    final List<double> embedding = _embedding!;
    setState(() => _passed = true);
    _timer?.cancel();
    await Future<void>.delayed(const Duration(milliseconds: 450));
    if (!mounted) return;

    Navigator.of(context).pop(<String, Object>{
      'passed': true,
      'mode': 'passive',
      'completedAt': DateTime.now().toUtc().toIso8601String(),
      'score': 1.0,
      'padScore': _padScore(),
      'embedding': embedding,
    });
  }

  double _padScore() {
    final double size = (_relativeFaceWidth / 0.35).clamp(0.0, 1.0);
    return (_liveness.motionScore * 0.4 +
            _liveness.depthScore * 0.4 +
            size * 0.2)
        .clamp(0.0, 1.0);
  }

  void _retry() {
    setState(() {
      _error = null;
      _hint = null;
      _progress = 0;
      _relativeFaceWidth = 0;
      _embedding = null;
      _blankFrames = 0;
      _startedAt = DateTime.now();
      _liveness.reset();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _controller?.dispose();
    _detector.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final CameraController? controller = _controller;
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
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
            else
              const ColoredBox(color: Color(0xFF0B1220)),
            _scrim(),
            SafeArea(
              child: Column(
                children: <Widget>[
                  _header(),
                  const Spacer(),
                  _reticle(),
                  const Spacer(),
                  _footer(),
                ],
              ),
            ),
            if (_error != null) _errorOverlay(),
          ],
        ),
      ),
    );
  }

  Widget _scrim() => DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[
              Colors.black.withOpacity(0.55),
              Colors.transparent,
              Colors.black.withOpacity(0.75),
            ],
            stops: const <double>[0, 0.45, 1],
          ),
        ),
      );

  Widget _header() => Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    _passed
                        ? 'Wajah Terverifikasi'
                        : 'Tahan Ponsel, Lihat Kamera',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _passed
                        ? 'Lanjut ke verifikasiâ€¦'
                        : '${widget.displayName} · Verifikasi Kehadiran',
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.75), fontSize: 13),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.close, color: Colors.white),
              tooltip: 'Batal',
            ),
          ],
        ),
      );

  Widget _reticle() {
    final bool ok = _passed;
    final Color ring = ok ? AppColors.success : Colors.white;
    return SizedBox(
      width: 320,
      height: 400,
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppColors.radiusViewport),
              border: Border.all(color: ring.withOpacity(0.55), width: 2),
              color: Colors.black.withOpacity(0.08),
            ),
          ),
          const CustomPaint(
            size: Size(320, 400),
            painter: _ScanFramePainter(),
          ),
          TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: ok ? 1 : _progress),
            duration: const Duration(milliseconds: 260),
            builder: (BuildContext _, double v, Widget? child) => SizedBox(
              width: 286,
              height: 286,
              child: CircularProgressIndicator(
                value: v,
                strokeWidth: 3.5,
                backgroundColor: Colors.white.withOpacity(0.18),
                valueColor: AlwaysStoppedAnimation<Color>(ring),
              ),
            ),
          ),
          Container(
            width: 216,
            height: 272,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(108),
              border: Border.all(
                color: ring.withOpacity(ok ? 0.9 : 0.35),
                width: 2,
              ),
              color:
                  ok ? AppColors.success.withOpacity(0.12) : Colors.transparent,
            ),
            child: ok
                ? const Icon(Icons.check_circle,
                    color: AppColors.success, size: 76)
                : const Icon(Icons.face_retouching_natural,
                    color: Colors.white24, size: 64),
          ),
        ],
      ),
    );
  }

  Widget _footer() => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
        child: Column(
          children: <Widget>[
            if (_hint != null) ...<Widget>[
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.45),
                  borderRadius: BorderRadius.circular(AppColors.radiusFull),
                ),
                child: Text(
                  _hint!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 12.5),
                ),
              ),
              const SizedBox(height: 14),
            ],
            Text(
              _passed
                  ? 'Memproses…'
                  : 'Pemindaian otomatis. Tatap kamera dan jaga wajah tetap di bingkai.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Colors.white.withOpacity(0.72), fontSize: 12),
            ),
          ],
        ),
      );

  Widget _errorOverlay() => Container(
        color: Colors.black.withOpacity(0.82),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Icon(Icons.person_off_outlined,
                    color: Colors.white54, size: 52),
                const SizedBox(height: 14),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 14, height: 1.45),
                ),
                const SizedBox(height: 22),
                FilledButton.icon(
                  onPressed: _retry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Coba Lagi'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: const Text('Batal',
                      style: TextStyle(color: Colors.white70)),
                ),
              ],
            ),
          ),
        ),
      );
}

class _ScanFramePainter extends CustomPainter {
  const _ScanFramePainter();

  @override
  void paint(Canvas canvas, Size size) {
    const double inset = 18;
    const double length = 28;
    final double right = size.width - inset;
    final double bottom = size.height - inset;
    final Paint paint = Paint()
      ..color = const Color(0xFF89F5E7)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final List<(Offset, Offset)> corners = <(Offset, Offset)>[
      (const Offset(inset, inset), const Offset(inset + length, inset)),
      (const Offset(inset, inset), const Offset(inset, inset + length)),
      (Offset(right, inset), Offset(right - length, inset)),
      (Offset(right, inset), Offset(right, inset + length)),
      (Offset(inset, bottom), Offset(inset + length, bottom)),
      (Offset(inset, bottom), Offset(inset, bottom - length)),
      (Offset(right, bottom), Offset(right - length, bottom)),
      (Offset(right, bottom), Offset(right, bottom - length)),
    ];
    for (final (Offset start, Offset end) in corners) {
      canvas.drawLine(start, end, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ScanFramePainter oldDelegate) => false;
}
