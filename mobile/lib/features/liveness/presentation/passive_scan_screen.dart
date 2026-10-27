import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:camera/camera.dart';
// ignore_for_file: empty_catches
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;

import '../../../core/theme/app_colors.dart';
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
            _header(progress),
            _progressBar(progress),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    _instructionCard(),
                    const SizedBox(height: 12),
                    _viewport(controller),
                    const SizedBox(height: 10),
                    _telemetry(progress),
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
                      _errorCard(),
                    ],
                  ],
                ),
              ),
            ),
            _footer(progress),
          ],
        ),
      ),
    );
  }

  Widget _header(double progress) => Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: AppColors.inverseSurface,
          border: Border(
            bottom: BorderSide(color: Colors.white.withOpacity(0.1)),
          ),
        ),
        child: Row(
          children: <Widget>[
            InkWell(
              onTap: () => Navigator.of(context).maybePop(),
              borderRadius: BorderRadius.circular(AppColors.radiusFull),
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back,
                    color: Colors.white, size: 20),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text(
                    'Verifikasi Kehadiran',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.2,
                    ),
                  ),
                  Text(
                    '${widget.displayName} · Presensi Wajah',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.primaryFixed,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primaryContainer.withOpacity(0.85),
                borderRadius: BorderRadius.circular(AppColors.radiusFull),
                border: Border.all(
                    color: AppColors.primaryFixed.withOpacity(0.4)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.primaryFixed,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 7),
                  Text(
                    'Liveness\n${(progress * 100).round()}%',
                    textAlign: TextAlign.left,
                    style: const TextStyle(
                      color: AppColors.onPrimaryContainer,
                      fontSize: 10.5,
                      height: 1.25,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _progressBar(double progress) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
        child: Column(
          children: <Widget>[
            Row(
              children: <Widget>[
                const Expanded(
                  child: Row(
                    children: <Widget>[
                      Icon(Icons.verified_user_outlined,
                          size: 16, color: AppColors.primaryFixed),
                      SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Verifikasi Wajah (Liveness)',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.surfaceHigh,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Progres: ${(progress * 100).round()}%',
                  style: const TextStyle(
                    color: AppColors.primaryFixed,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppColors.radiusFull),
              child: Container(
                height: 5,
                color: Colors.white.withOpacity(0.15),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FractionallySizedBox(
                    widthFactor: progress.clamp(0.04, 1.0),
                    child: Container(color: AppColors.primaryFixed),
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _instructionCard() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppColors.radiusCard),
          border: const Border(
            left: BorderSide(color: AppColors.primary, width: 4),
          ),
          boxShadow: AppColors.shadow2,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                _passed
                    ? Icons.verified_user
                    : (_error != null
                        ? Icons.error_outline
                        : Icons.visibility_outlined),
                color: AppColors.primary,
                size: 22,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      const Expanded(
                        child: Text(
                          'VERIFIKASI WAJAH AKTIF',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceHigh,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusFull),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            const Icon(Icons.timer_outlined,
                                size: 12, color: AppColors.primary),
                            const SizedBox(width: 4),
                            Text(
                              '$_countdown dtk',
                              style: const TextStyle(
                                color: AppColors.onSecondaryFixed,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                fontFeatures: <FontFeature>[
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _statusTitle,
                    style: const TextStyle(
                      color: AppColors.ink,
                      fontSize: 15,
                      height: 1.3,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _statusBody,
                    style: const TextStyle(
                      color: AppColors.inkSecondary,
                      fontSize: 11.5,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _viewport(CameraController? controller) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: AspectRatio(
            aspectRatio: 0.82,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.ink,
                borderRadius: BorderRadius.circular(AppColors.radiusViewport),
                border: Border.all(
                  color: (_passed ? AppColors.success : AppColors.primaryFixed)
                      .withOpacity(0.45),
                  width: 2,
                ),
                boxShadow: AppColors.shadow3,
              ),
              clipBehavior: Clip.antiAlias,
              child: controller == null
                  ? Center(
                      child: _error != null
                          ? Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    color: Colors.white, fontSize: 13),
                              ),
                            )
                          : const CircularProgressIndicator(
                              color: AppColors.primaryFixed),
                    )
                  : Stack(
                      fit: StackFit.expand,
                      children: <Widget>[
                        FittedBox(
                          fit: BoxFit.cover,
                          child: SizedBox(
                            width: controller.value.previewSize?.height ?? 1,
                            height: controller.value.previewSize?.width ?? 1,
                            child: CameraPreview(controller),
                          ),
                        ),
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: <Color>[
                                AppColors.inverseSurface.withOpacity(0.55),
                                Colors.transparent,
                                AppColors.inverseSurface.withOpacity(0.7),
                              ],
                              stops: const <double>[0, 0.4, 1],
                            ),
                          ),
                        ),
                        CustomPaint(
                          painter: _FaceHudPainter(
                            progress: _passed ? 1 : _progress,
                            passed: _passed,
                          ),
                        ),
                        if (_passed)
                          const Center(
                            child: Icon(Icons.check_circle,
                                color: AppColors.success, size: 72),
                          ),
                        Align(
                          alignment: Alignment.topCenter,
                          child: Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: _hudPill(
                              dotColor: _faceCount == 1
                                  ? AppColors.success
                                  : AppColors.primaryFixed,
                              icon: Icons.center_focus_strong,
                              label: _passed
                                  ? 'Wajah Terverifikasi'
                                  : (_faceCount == 1
                                      ? 'Pelacakan Wajah Aktif'
                                      : (_faceCount > 1
                                          ? 'Wajah Lebih dari Satu'
                                          : 'Mencari Wajah')),
                            ),
                          ),
                        ),
                        Align(
                          alignment: Alignment.bottomCenter,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 5),
                              decoration: BoxDecoration(
                                color: AppColors.primaryContainer
                                    .withOpacity(0.9),
                                borderRadius: BorderRadius.circular(
                                    AppColors.radiusFull),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  Icon(
                                    _passed
                                        ? Icons.verified
                                        : Icons.straighten,
                                    size: 13,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 5),
                                  Text(
                                    _passed
                                        ? 'Liveness Lolos'
                                        : 'Jaga Posisi Tegak Lurus',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      );

  Widget _hudPill({
    required Color dotColor,
    required IconData icon,
    required String label,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.inverseSurface.withOpacity(0.85),
          borderRadius: BorderRadius.circular(AppColors.radiusFull),
          border: Border.all(
              color: AppColors.primaryFixed.withOpacity(0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            Icon(icon, size: 12, color: AppColors.onInverseSurface),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );

  Widget _telemetry(double progress) {
    final bool detected = _faceCount == 1;
    final bool idealDistance = _relativeFaceWidth >= 0.22;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.inverseSurface.withOpacity(0.85),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.18)),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: _telemetryColumn(
              title: 'WAJAH',
              value: detected
                  ? 'Optimal'
                  : (_faceCount > 1 ? 'Ganda' : 'Posisikan'),
              ok: detected,
            ),
          ),
          _telemetryDivider(),
          Expanded(
            child: _telemetryColumn(
              title: 'JARAK',
              value: !detected
                  ? 'Menyesuaikan'
                  : (idealDistance ? 'Ideal' : 'Dekatkan'),
              ok: detected && idealDistance,
            ),
          ),
          _telemetryDivider(),
          Expanded(
            child: _telemetryColumn(
              title: 'LIVENESS',
              value: '${(progress * 100).round()}% (Tinggi)',
              ok: progress > 0,
              icon: Icons.verified_user,
            ),
          ),
        ],
      ),
    );
  }

  Widget _telemetryDivider() => Container(
      width: 1, height: 26, color: Colors.white.withOpacity(0.15));

  Widget _telemetryColumn({
    required String title,
    required String value,
    required bool ok,
    IconData? icon,
  }) {
    return Column(
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            if (icon != null) ...<Widget>[
              Icon(icon, size: 12, color: AppColors.primaryFixed),
              const SizedBox(width: 4),
            ] else ...<Widget>[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: ok ? AppColors.primaryFixed : Colors.orangeAccent,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withOpacity(0.6),
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: ok ? AppColors.primaryFixed : Colors.white70,
          ),
        ),
      ],
    );
  }

  Widget _errorCard() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.errorTint.withOpacity(0.14),
          borderRadius: BorderRadius.circular(AppColors.radiusCardSmall),
          border: Border.all(color: AppColors.error.withOpacity(0.7)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Icon(Icons.error_outline,
                size: 18, color: AppColors.errorTint),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _error!,
                style: const TextStyle(
                  color: AppColors.onInverseSurface,
                  fontSize: 12,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _footer(double progress) => Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: BoxDecoration(
          color: AppColors.inverseSurface,
          border: Border(
            top: BorderSide(color: Colors.white.withOpacity(0.12)),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(
              width: double.infinity,
              height: AppColors.buttonHeight,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primaryContainer,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor:
                      AppColors.primaryContainer.withOpacity(0.6),
                  disabledForegroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppColors.radiusButton),
                  ),
                ),
                onPressed: _passed
                    ? null
                    : (_error != null ? _retry : _tick),
                icon: Icon(
                  _passed
                      ? Icons.verified
                      : (_error != null
                          ? Icons.refresh
                          : Icons.photo_camera_outlined),
                  size: 20,
                ),
                label: Text(
                  _passed
                      ? 'Wajah Terverifikasi'
                      : (_error != null ? 'Coba Pindai Ulang' : 'Pindai Sekarang'),
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: AppColors.ghostHeight,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  backgroundColor: Colors.white.withOpacity(0.08),
                  side: BorderSide(color: Colors.white.withOpacity(0.25)),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppColors.radiusCardSmall),
                  ),
                ),
                onPressed:
                    _passed ? null : () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.close, size: 18),
                label: const Text(
                  'Batalkan Presensi',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                Text(
                  'Anti-spoofing aktif',
                  style: TextStyle(
                      fontSize: 10, color: Colors.white.withOpacity(0.5)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'ID Karyawan: ${widget.displayName}',
                    textAlign: TextAlign.right,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 10, color: Colors.white.withOpacity(0.5)),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
}

/// Clinical face guides: brackets, oval scan target, eye anchors, percentage
/// arc and a mouth reference line.
class _FaceHudPainter extends CustomPainter {
  const _FaceHudPainter({required this.progress, required this.passed});

  final double progress;
  final bool passed;

  @override
  void paint(Canvas canvas, Size size) {
    final Color accent = passed ? AppColors.success : AppColors.primaryFixed;
    final Rect oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.47),
      width: size.width * 0.62,
      height: size.height * 0.56,
    );

    canvas.drawOval(
      oval,
      Paint()
        ..color = accent.withOpacity(0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4,
    );

    canvas.drawArc(
      oval,
      -math.pi / 2,
      2 * math.pi * progress.clamp(0, 1),
      false,
      Paint()
        ..color = accent
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );

    final Paint eyeRing = Paint()
      ..color = AppColors.inversePrimary.withOpacity(0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    final Paint eyeDot = Paint()
      ..color = AppColors.inversePrimary
      ..style = PaintingStyle.fill;
    final Offset leftEye = Offset(size.width * 0.40, size.height * 0.43);
    final Offset rightEye = Offset(size.width * 0.60, size.height * 0.43);
    canvas.drawCircle(leftEye, 12, eyeRing);
    canvas.drawCircle(leftEye, 3.5, eyeDot);
    canvas.drawCircle(rightEye, 12, eyeRing);
    canvas.drawCircle(rightEye, 3.5, eyeDot);

    canvas.drawLine(
      Offset(size.width * 0.43, size.height * 0.64),
      Offset(size.width * 0.57, size.height * 0.64),
      Paint()
        ..color = accent.withOpacity(0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    final Paint bracket = Paint()
      ..color = accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round;
    const double length = 20;
    const double pad = 12;
    final double right = size.width - pad;
    final double bottom = size.height - pad;
    for (final (Offset start, Offset end) in <(Offset, Offset)>[
      (const Offset(pad, pad), const Offset(pad + length, pad)),
      (const Offset(pad, pad), const Offset(pad, pad + length)),
      (Offset(right, pad), Offset(right - length, pad)),
      (Offset(right, pad), Offset(right, pad + length)),
      (Offset(pad, bottom), Offset(pad + length, bottom)),
      (Offset(pad, bottom), Offset(pad, bottom - length)),
      (Offset(right, bottom), Offset(right - length, bottom)),
      (Offset(right, bottom), Offset(right, bottom - length)),
    ]) {
      canvas.drawLine(start, end, bracket);
    }
  }

  @override
  bool shouldRepaint(covariant _FaceHudPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.passed != passed;
}
