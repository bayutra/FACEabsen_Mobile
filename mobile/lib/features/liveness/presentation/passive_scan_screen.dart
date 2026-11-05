import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:camera/camera.dart';
// ignore_for_file: empty_catches
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;

import '../../../core/theme/app_colors.dart';
import 'passive_scan_widgets.dart';
import '../domain/eye_geometry.dart';
import '../domain/passive_liveness.dart';
import '../../face/data/face_detector.dart';
import '../../face/data/facial_landmark_embedder.dart';
import '../../face/data/face_repository.dart';
import 'liveness_screen.dart' show contourOf;

/// Passive liveness capture for attendance.
///
/// The layout follows the clinical dark HUD in
/// `docs/design/mobile/presensi_liveness_challenge_biometrik`: header with
/// progress, a medical instruction card, a framed camera viewport with face
/// guides, live telemetry, and the capture / cancel actions in the thumb zone.
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
  late final FacialLandmarkEmbedder _landmarks;
  late final PassiveLiveness _liveness;
  Timer? _timer;

  String? _error;
  String? _hint;

  static const int _blankLimit = 8;

  bool _processing = false;
  bool _passed = false;
  List<double>? _embedding;
  int _blankFrames = 0;
  int _faceCount = 0;
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
    _landmarks = FacialLandmarkEmbedder();
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
        _faceCount = 0;
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
        if (mounted) setState(() => _faceCount = faces.length);

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
        FaceLandmarkCenter? landmarkCenter;
        try {
          landmarkCenter = await _landmarks.predict(
            shot.path,
            leftEdge: f.boundingBox.left,
            topEdge: f.boundingBox.top,
            faceWidth: f.boundingBox.width,
            faceHeight: f.boundingBox.height,
          );
        } catch (_) {
          // Keep attendance available through the existing ML Kit signal.
        }

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
          landmarkX: landmarkCenter?.x ?? noseX,
          landmarkY: landmarkCenter?.y ?? noseY,
        );
        if (mounted) {
          setState(() {
            _faceCount = 1;
            _relativeFaceWidth = rel;
          });
        }
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
      _faceCount = 0;
      _relativeFaceWidth = 0;
      _embedding = null;
      _blankFrames = 0;
      _startedAt = DateTime.now();
      _liveness.reset();
    });
    if (_controller == null) {
      _initCamera();
      return;
    }
    if (_timer == null || !_timer!.isActive) {
      _timer =
          Timer.periodic(const Duration(milliseconds: 400), (_) => _tick());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _controller?.dispose();
    _detector.dispose();
    _landmarks.close();
    super.dispose();
  }

  Duration get _remaining {
    final Duration elapsed = DateTime.now().difference(_startedAt);
    final Duration left = _timeout - elapsed;
    return left.isNegative ? Duration.zero : left;
  }

  String get _countdown {
    final Duration left = _remaining;
    final String seconds = left.inSeconds.toString().padLeft(2, '0');
    return '00:$seconds';
  }

  String get _statusTitle {
    if (_passed) return 'Liveness Terverifikasi Sempurna';
    if (_error != null) return 'Pemindaian Terhenti';
    if (_faceCount > 1) return 'Lebih dari Satu Wajah Terdeteksi';
    if (_faceCount == 0) return 'Posisikan Wajah di Dalam Bingkai';
    return 'Tatap Kamera & Tahan Posisi';
  }

  String get _statusBody {
    if (_passed) {
      return 'Wajah dan liveness terverifikasi. Menyiapkan data presensi…';
    }
    if (_error != null) {
      return 'Pemindaian dihentikan. Periksa pencahayaan dan posisi wajah, '
          'lalu pindai ulang.';
    }
    if (_hint != null) return _hint!;
    return 'Pemindaian berjalan otomatis. Jaga wajah tetap di dalam panduan, '
        'hindari gerakan cepat, dan tidak memegang foto.';
  }

  @override
  Widget build(BuildContext context) {
    final CameraController? controller = _controller;
    final double progress = _passed ? 1 : _progress.clamp(0, 1);

    return Scaffold(
      backgroundColor: AppColors.inverseSurface,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: <Widget>[
            header(context, widget.displayName, progress),
            progressBar(progress),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    instructionCard(
                      passed: _passed,
                      error: _error,
                      countdown: _countdown,
                      statusTitle: _statusTitle,
                      statusBody: _statusBody,
                    ),
                    const SizedBox(height: 12),
                    scanViewport(
                      controller: controller,
                      passed: _passed,
                      error: _error,
                      progress: progress,
                      faceCount: _faceCount,
                    ),
                    const SizedBox(height: 10),
                    telemetry(
                      progress: progress,
                      faceCount: _faceCount,
                      relativeFaceWidth: _relativeFaceWidth,
                    ),
                    const SizedBox(height: 8),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: <Widget>[
                        Icon(Icons.lock_outline,
                            size: 13, color: AppColors.surfaceHigh),
                        SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            'Enkripsi Biometrik ISO/IEC 30107-3 Liveness '
                            'Anti-Spoofing',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 10.5, color: AppColors.surfaceHigh),
                          ),
                        ),
                      ],
                    ),
                    if (_error != null) ...<Widget>[
                      const SizedBox(height: 12),
                      errorCard(_error!),
                    ],
                  ],
                ),
              ),
            ),
            footer(
              context: context,
              passed: _passed,
              error: _error,
              displayName: widget.displayName,
              onRetry: _retry,
              onTick: _tick,
            ),
          ],
        ),
      ),
    );
  }
}
