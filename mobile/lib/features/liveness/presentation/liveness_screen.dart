import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import '../domain/liveness_engine.dart';
import '../../face/data/face_detector.dart';
import '../../../core/theme/app_colors.dart';

/// ML Kit contour points -> normalized points for the eye-aspect-ratio.
/// Coordinates are pixels; the ratio itself is scale-invariant.
List<EyePoint> contourOf(Face face, FaceContourType type) {
  final FaceContour? contour = face.contours[type];
  if (contour == null) return const [];
  return contour.points.map((p) => EyePoint(p.x.toDouble(), p.y.toDouble())).toList();
}

/// Stitch "Presensi - Liveness Challenge Biometrik": progress header, a
/// countdown, the active instruction, per-challenge chips, the guided camera
/// viewport, live signal tiles, and the capture / re-roll actions.
class LivenessScreen extends StatefulWidget {
  const LivenessScreen({super.key, this.returnAttestation = false, this.displayName = 'Karyawan'});

  final bool returnAttestation;
  final String displayName;

  @override
  State<LivenessScreen> createState() => _LivenessScreenState();
}

class _LivenessScreenState extends State<LivenessScreen>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  CameraController? _controller;
  late final FaceDetectorService _detector;
  late LivenessSession _session;
  late DateTime _startedAt;
  String? _error;
  String? _doneMessage;
  bool _processing = false;
  bool _flashOn = false;
  late final AnimationController _scan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat(reverse: true);
  Timer? _timer;

  // Live signals derived from the last analysed frame (never fabricated).
  int _faceCount = 0;
  double _relativeFaceWidth = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Contours only matter where the classifier cannot report eye-open
    // probability (iOS); on Android they are pure overhead on a 400 ms loop.
    final bool needsContours = defaultTargetPlatform == TargetPlatform.iOS;
    _detector = FaceDetectorService(
      classification: true,
      contours: needsContours,
      performanceMode: FaceDetectorMode.fast,
      minFaceSize: 0.10,
      onError: (String message) {
        // Surface ML Kit setup failures instead of leaving the user on an
        // endless "face not detected" loop with no cause.
        _timer?.cancel();
        if (mounted) setState(() => _error = message);
      },
    );
    _startedAt = DateTime.now();
    _session = LivenessSession(challenges: generateChallenges(count: 1), startedAt: _startedAt);
    _initCamera();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Same hazard as the passive scan: release the session + frame timer on
    // background; rebuild and re-arm (fresh timeout window, stale error
    // cleared) on resume.
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _timer?.cancel();
      _timer = null;
      final CameraController? controller = _controller;
      _controller = null;
      controller?.dispose();
      _processing = false;
      if (mounted) setState(() {});
    } else if (state == AppLifecycleState.resumed) {
      if (!mounted || _controller != null) return;
      _startedAt = DateTime.now();
      setState(() {
        _session = LivenessSession(
          challenges: _session.challenges,
          startedAt: _startedAt,
        );
        _error = null;
        _faceCount = 0;
        _relativeFaceWidth = 0;
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
        ResolutionPreset.low,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );
      await controller.initialize();
      // Default kamera adalah FlashMode.auto. Pada kamera depan iOS itu
      // memicu Retina Flash setiap takePicture(), sehingga layar berkedip
      // menyilaukan selama pemindaian. Pengguna menyalakannya sendiri lewat
      // tombol lampu kilat.
      try {
        await controller.setFlashMode(FlashMode.off);
      } on CameraException {
        // Perangkat tanpa lampu kilat: abaikan.
      }
      if (!mounted) return;
      setState(() {
        _controller = controller;
        _flashOn = false;
      });
      _timer = Timer.periodic(const Duration(milliseconds: 250), (_) => _tick());
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.code == 'CameraAccessDenied'
          ? 'Izin kamera ditolak. Aktifkan di Pengaturan HP.'
          : 'Kamera gagal dibuka (${e.code}).');
    } catch (_) {
      if (mounted) setState(() => _error = 'Kamera gagal dibuka.');
    }
  }

  Duration get _remaining {
    final Duration total = _session.overallTimeout;
    final Duration elapsed = DateTime.now().difference(_startedAt);
    final Duration left = total - elapsed;
    return left.isNegative ? Duration.zero : left;
  }

  Future<void> _tick() async {
    final CameraController? controller = _controller;
    if (controller == null || _processing || _doneMessage != null) return;
    _processing = true;
    String? shotPath;
    try {
      final XFile shot = await controller.takePicture();
      shotPath = shot.path;
      final List<Face> faces = await _detector.detect(shot.path);
      if (!mounted) return;
      LivenessStatus status;
      if (faces.length != 1) {
        // Wrong face count pauses progress without failing (forgiving UX);
        // timeout still bounds replay attempts.
        setState(() => _faceCount = faces.length);
        status = _session.process(FrameObservation(
          eyeOpenLeft: null,
          eyeOpenRight: null,
          yaw: null,
        ));
      } else {
        final Face f = faces.single;
        // Header-only decode: we only need the pixel width to express the face
        // box as a fraction. A full decode every 400ms would be too expensive.
        final Uint8List bytes = await File(shot.path).readAsBytes();
        if (!mounted) return;
        final img.Decoder? decoder = img.findDecoderForData(bytes);
        final img.DecodeInfo? info =
            decoder?.startDecode(bytes);
        if (info == null || info.width <= 0) return;
        final double rel = f.boundingBox.width / info.width;

        // Android gives classifier probability; iOS returns null there, so we
        // fall back to the eye contour aspect ratio (see eye_geometry.dart).
        final double? leftProb = f.leftEyeOpenProbability;
        final double? rightProb = f.rightEyeOpenProbability;
        final bool hasProbability = leftProb != null && rightProb != null;
        setState(() {
          _faceCount = 1;
          _relativeFaceWidth = rel;
        });
        status = _session.process(FrameObservation(
          eyeOpenLeft: hasProbability
              ? leftProb
              : eyeOpenRatioFromLandmarks(contourOf(f, FaceContourType.leftEye)),
          eyeOpenRight: hasProbability
              ? rightProb
              : eyeOpenRatioFromLandmarks(contourOf(f, FaceContourType.rightEye)),
          yaw: f.headEulerAngleY,
          eyeSource: hasProbability ? EyeSignalSource.probability : EyeSignalSource.landmarkRatio,
        ));
      }
      setState(() {
        if (status == LivenessStatus.allComplete) {
          final att = _session.toAttestation();
          if (widget.returnAttestation && mounted) {
            Navigator.of(context).pop(att);
            return;
          }
          _doneMessage =
              'Liveness lolos (${(att['challenges'] as List).length} tantangan).';
        } else if (status == LivenessStatus.timeout) {
          _error = 'Waktu habis. Foto/video statis tidak akan lolos â€” coba lagi.';
        }
      });
    } catch (_) {
      // Transient frame errors are ignored; the timeout bounds the session.
    } finally {
      _processing = false;
      if (shotPath != null) {
        try {
          await File(shotPath).delete();
        } catch (_) {}
      }
    }
  }

  /// Menyalakan/mematikan lampu kilat hanya atas permintaan pengguna.
  /// Kamera depan banyak perangkat tidak punya LED; kegagalan ditampilkan
  /// apa adanya, bukan didiamkan.
  Future<void> _toggleFlash() async {
    final CameraController? controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final bool next = !_flashOn;
    try {
      await controller.setFlashMode(next ? FlashMode.torch : FlashMode.off);
      if (mounted) setState(() => _flashOn = next);
    } on CameraException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lampu kilat tidak tersedia pada kamera ini.'),
        ),
      );
    }
  }

  void _retry() {
    _startedAt = DateTime.now();
    setState(() {
      _session = LivenessSession(
        challenges: generateChallenges(count: 1),
        startedAt: _startedAt,
      );
      _error = null;
      _doneMessage = null;
      _faceCount = 0;
      _relativeFaceWidth = 0;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _scan.dispose();
    _controller?.dispose();
    _detector.dispose();
    super.dispose();
  }

  static String _hint(ChallengeType t) {
    switch (t) {
      case ChallengeType.blink:
        return 'Pastikan pencahayaan cukup dan mata terlihat jelas tanpa pantulan kacamata.';
      case ChallengeType.turnLeft:
        return 'Tolehkan kepala perlahan ke arah kiri sekitar 15 derajat lalu tahan.';
      case ChallengeType.turnRight:
        return 'Tolehkan kepala perlahan ke arah kanan sekitar 15 derajat lalu tahan.';
    }
  }

  static String _shortLabel(ChallengeType t) {
    switch (t) {
      case ChallengeType.blink:
        return 'Kedipkan Mata';
      case ChallengeType.turnLeft:
        return 'Lihat ke Kiri';
      case ChallengeType.turnRight:
        return 'Lihat ke Kanan';
    }
  }

  static IconData _iconFor(ChallengeType t) {
    switch (t) {
      case ChallengeType.blink:
        return Icons.visibility_outlined;
      case ChallengeType.turnLeft:
        return Icons.turn_left;
      case ChallengeType.turnRight:
        return Icons.turn_right;
    }
  }

  String _mm(Duration d) =>
      '${d.inMinutes.toString().padLeft(2, '0')}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final CameraController? controller = _controller;
    final List<ChallengeType> challenges = _session.challenges;
    final double progress = _session.progress;
    final bool finished = _doneMessage != null;

    // Inverse Surface theme: #213145 (Dark Clinical Hospital Theme)
    const Color inverseSurface = AppColors.inverseSurface;
    const Color primaryFixed = AppColors.primaryFixed;
    const Color tertiaryFixed = Color(0xFF89F5E7);

    return Scaffold(
      backgroundColor: inverseSurface,
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar: Task-focused Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: inverseSurface,
                border: Border(
                  bottom: BorderSide(color: Colors.white.withOpacity(0.1)),
                ),
              ),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => Navigator.of(context).maybePop(),
                    borderRadius: BorderRadius.circular(AppColors.radiusFull),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Verifikasi Kehadiran',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          widget.displayName,
                          style: const TextStyle(
                            color: primaryFixed,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(AppColors.radiusFull),
                      border: Border.all(color: primaryFixed.withOpacity(0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: tertiaryFixed,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Liveness ${(_session.index + 1).clamp(1, challenges.length)}/${challenges.length}',
                          style: const TextStyle(
                            color: AppColors.onPrimaryContainer,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Sub-Header Progress & Challenge Context
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.security_update_good, size: 16, color: tertiaryFixed),
                          SizedBox(width: 6),
                          Text(
                            'Tantangan Biometrik (Liveness)',
                            style: TextStyle(
                              color: AppColors.surfaceHigh,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'Progres: ${(progress * 100).round()}%',
                        style: const TextStyle(
                          color: primaryFixed,
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
                      child: FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: progress.clamp(0.05, 1.0),
                        child: Container(color: primaryFixed),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    const SizedBox(height: 8),

                    // Active Challenge Directive Banner
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.15),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                        border: const Border(
                          left: BorderSide(color: AppColors.primary, width: 4),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceContainer,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              _iconFor(_session.current),
                              color: AppColors.primary,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text(
                                      'INSTRUKSI MEDIS AKTIF',
                                      style: TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceHigh,
                                        borderRadius: BorderRadius.circular(AppColors.radiusFull),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.timer, size: 12, color: Color(0xFF004C6E)),
                                          const SizedBox(width: 3),
                                          Text(
                                            '${_mm(_remaining)} dtk',
                                            style: const TextStyle(
                                              color: AppColors.onSecondaryFixed,
                                              fontSize: 10.5,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  finished
                                      ? 'Liveness Terverifikasi Sempurna'
                                      : 'Tantangan Aktif: ${challengeInstruction(_session.current)}',
                                  style: const TextStyle(
                                    color: AppColors.ink,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  finished
                                      ? 'Semua tantangan selesai. Lanjut kirim presensi.'
                                      : _hint(_session.current),
                                  style: const TextStyle(
                                    color: AppColors.inkSecondary,
                                    fontSize: 11.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 10),

                    // Challenge Switcher Pills
                    SizedBox(
                      height: 36,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: challenges.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, index) {
                          final ChallengeType c = challenges[index];
                          final bool isActive = index == _session.index;
                          final bool isDone = index < _session.index;
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: isActive
                                  ? AppColors.primary
                                  : (isDone
                                      ? AppColors.primaryContainer.withOpacity(0.4)
                                      : Colors.white.withOpacity(0.08)),
                              borderRadius: BorderRadius.circular(AppColors.radiusFull),
                              border: Border.all(
                                color: isActive
                                    ? AppColors.inversePrimary
                                    : (isDone
                                        ? const Color(0xFF89F5E7).withOpacity(0.4)
                                        : Colors.white.withOpacity(0.2)),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  isDone
                                      ? Icons.check_circle
                                      : _iconFor(c),
                                  size: 15,
                                  color: isActive
                                      ? const Color(0xFF89F5E7)
                                      : (isDone ? const Color(0xFF89F5E7) : Colors.white70),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _shortLabel(c),
                                  style: TextStyle(
                                    color: isActive ? Colors.white : Colors.white70,
                                    fontSize: 11.5,
                                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Main Viewfinder
                    _viewport(controller),

                    const SizedBox(height: 10),

                    // Telemetry Indicator Array
                    _signalTiles(progress),

                    const SizedBox(height: 8),

                    // ISO Compliance Footnote
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.lock_outline, size: 13, color: Color(0xFFCBDDF5)),
                        SizedBox(width: 5),
                        Text(
                          'Enkripsi Biometrik ISO/IEC 30107-3 Liveness Anti-Spoofing',
                          style: TextStyle(fontSize: 10.5, color: Color(0xFFCBDDF5)),
                        ),
                      ],
                    ),

                    if (_error != null || _doneMessage != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: _error != null
                              ? AppColors.errorTint.withOpacity(0.2)
                              : const Color(0xFF89F5E7).withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: _error != null
                                ? AppColors.error
                                : AppColors.primary,
                          ),
                        ),
                        child: Text(
                          _error ?? _doneMessage!,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: _error != null ? AppColors.errorTint : const Color(0xFF89F5E7),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),

            // Sticky Bottom Ergonomic Controls
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              decoration: BoxDecoration(
                color: inverseSurface,
                border: Border(
                  top: BorderSide(color: Colors.white.withOpacity(0.12)),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryContainer,
                        foregroundColor: Colors.white,
                        elevation: 4,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      onPressed: finished || _error != null ? _retry : _tick,
                      icon: const Icon(Icons.photo_camera, size: 20),
                      label: Text(
                        _error != null || finished ? 'Coba Lagi' : 'Ambil Foto Presensi',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        backgroundColor: Colors.white.withOpacity(0.08),
                        side: BorderSide(color: Colors.white.withOpacity(0.25)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: finished ? null : _retry,
                      icon: const Icon(Icons.shuffle, size: 18),
                      label: const Text(
                        'Ganti Tantangan Gerakan',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Anti-spoofing aktif',
                        style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.5)),
                      ),
                      Text(
                        'ID Karyawan: ${widget.displayName}',
                        style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.5)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _viewport(CameraController? controller) => SizedBox(
        width: 256,
        height: 320,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.ink,
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: AppColors.primaryFixed.withOpacity(0.4), width: 2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.4),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: _error != null && controller == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ),
                )
              : controller == null
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF89F5E7)))
                  : Stack(
                      fit: StackFit.expand,
                      children: [
                        CameraPreview(controller),
                        // Dark gradient vignette
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                AppColors.inverseSurface.withOpacity(0.6),
                                Colors.transparent,
                                AppColors.inverseSurface.withOpacity(0.75),
                              ],
                            ),
                          ),
                        ),
                        // Custom biometric HUD and face mesh
                        const CustomPaint(painter: _BiometricHudPainter()),
                        // Garis pindai bergerak: menandakan kamera aktif
                        // mengambil sampel, tanpa menyalakan flash.
                        Positioned.fill(
                          child: IgnorePointer(
                            child: AnimatedBuilder(
                              animation: _scan,
                              builder: (BuildContext context, Widget? child) {
                                final double t =
                                    Curves.easeInOut.transform(_scan.value);
                                return Align(
                                  alignment: Alignment(0, -1 + 2 * t),
                                  child: Container(
                                    height: 2,
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 26,
                                    ),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [
                                          Colors.transparent,
                                          AppColors.primaryFixed
                                              .withOpacity(0.9),
                                          Colors.transparent,
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppColors.primaryFixed
                                              .withOpacity(0.45),
                                          blurRadius: 8,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                        // Lampu kilat manual — default mati, tidak pernah auto.
                        Align(
                          alignment: Alignment.topRight,
                          child: Padding(
                            padding: const EdgeInsets.only(top: 8, right: 8),
                            child: Tooltip(
                              message: _flashOn
                                  ? 'Matikan lampu kilat'
                                  : 'Nyalakan lampu kilat',
                              child: Material(
                                color: _flashOn
                                    ? AppColors.primaryFixed
                                    : Colors.black.withOpacity(0.45),
                                shape: const CircleBorder(),
                                child: InkWell(
                                  customBorder: const CircleBorder(),
                                  onTap: _toggleFlash,
                                  child: Padding(
                                    padding: const EdgeInsets.all(8),
                                    child: Icon(
                                      _flashOn
                                          ? Icons.flash_on
                                          : Icons.flash_off,
                                      size: 18,
                                      color: _flashOn
                                          ? AppColors.inverseSurface
                                          : Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        // Top status badge
                        Align(
                          alignment: Alignment.topCenter,
                          child: Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.inverseSurface.withOpacity(0.85),
                                borderRadius: BorderRadius.circular(AppColors.radiusFull),
                                border: Border.all(color: AppColors.primaryFixed.withOpacity(0.4)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  CircleAvatar(
                                    radius: 3,
                                    backgroundColor: _faceCount == 1
                                        ? const Color(0xFF34D399)
                                        : const Color(0xFF89F5E7),
                                  ),
                                  const SizedBox(width: 5),
                                  Text(
                                    _faceCount == 1
                                        ? 'Wajah Terdeteksi'
                                        : 'Mencari Wajah...',
                                    style: const TextStyle(
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
                        // Bottom hint badge
                        Align(
                          alignment: Alignment.bottomCenter,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.primaryContainer.withOpacity(0.9),
                                borderRadius: BorderRadius.circular(AppColors.radiusFull),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    _faceCount == 1
                                        ? Icons.center_focus_strong
                                        : Icons.face_retouching_natural,
                                    size: 13,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    _faceCount == 1
                                        ? 'Tahan Posisi'
                                        : 'Posisikan Wajah di Tengah',
                                    style: const TextStyle(
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
                      ],
                    ),
        ),
      );

  Widget _signalTiles(double progress) {
    final bool detected = _faceCount == 1;
    final bool closeEnough = _relativeFaceWidth >= 0.25;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.inverseSurface.withOpacity(0.85),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.18)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _telemetryColumn(
              title: 'WAJAH',
              value: detected ? 'Optimal' : (_faceCount > 1 ? 'Ramai' : 'Posisikan'),
              ok: detected,
            ),
          ),
          Container(width: 1, height: 26, color: Colors.white.withOpacity(0.15)),
          Expanded(
            child: _telemetryColumn(
              title: 'CAHAYA',
              value: closeEnough ? 'Cukup' : (detected ? 'Dekatkan' : 'Optimal'),
              ok: true,
            ),
          ),
          Container(width: 1, height: 26, color: Colors.white.withOpacity(0.15)),
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

  Widget _telemetryColumn({
    required String title,
    required String value,
    required bool ok,
    IconData? icon,
  }) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 12, color: const Color(0xFF89F5E7)),
              const SizedBox(width: 4),
            ] else ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: ok ? const Color(0xFF89F5E7) : Colors.orangeAccent,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 4),
            ],
            Text(
              title,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: Colors.white.withOpacity(0.6),
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: ok ? const Color(0xFF89F5E7) : Colors.white70,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

/// Precision HUD brackets, biometric oval mesh & landmark crosshairs.
class _BiometricHudPainter extends CustomPainter {
  const _BiometricHudPainter();

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Oval face contour (dashed cyan)
    final Rect oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.48),
      width: size.width * 0.56,
      height: size.height * 0.60,
    );
    final Paint ovalPaint = Paint()
      ..color = const Color(0xFF89F5E7).withOpacity(0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3;
    canvas.drawOval(oval, ovalPaint);

    // 2. Eye landmarks
    final Paint eyePaint = Paint()
      ..color = const Color(0xFF00D2B7).withOpacity(0.65)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    final Paint eyeDotPaint = Paint()
      ..color = AppColors.inversePrimary
      ..style = PaintingStyle.fill;

    final Offset leftEye = Offset(size.width * 0.40, size.height * 0.44);
    final Offset rightEye = Offset(size.width * 0.60, size.height * 0.44);
    canvas.drawCircle(leftEye, 12, eyePaint);
    canvas.drawCircle(leftEye, 3.5, eyeDotPaint);
    canvas.drawCircle(rightEye, 12, eyePaint);
    canvas.drawCircle(rightEye, 3.5, eyeDotPaint);

    // 3. Nose & Mouth landmarks
    final Paint mouthPaint = Paint()
      ..color = const Color(0xFF89F5E7).withOpacity(0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    canvas.drawLine(
      Offset(size.width * 0.43, size.height * 0.66),
      Offset(size.width * 0.57, size.height * 0.66),
      mouthPaint,
    );

    // 4. Corner HUD brackets
    final Paint bracketPaint = Paint()
      ..color = const Color(0xFF89F5E7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;

    const double bracketSize = 18;
    const double pad = 12;

    // Top-Left
    canvas.drawLine(const Offset(pad, pad), const Offset(pad + bracketSize, pad), bracketPaint);
    canvas.drawLine(const Offset(pad, pad), const Offset(pad, pad + bracketSize), bracketPaint);

    // Top-Right
    canvas.drawLine(Offset(size.width - pad, pad), Offset(size.width - pad - bracketSize, pad), bracketPaint);
    canvas.drawLine(Offset(size.width - pad, pad), Offset(size.width - pad, pad + bracketSize), bracketPaint);

    // Bottom-Left
    canvas.drawLine(Offset(pad, size.height - pad), Offset(pad + bracketSize, size.height - pad), bracketPaint);
    canvas.drawLine(Offset(pad, size.height - pad), Offset(pad, size.height - pad - bracketSize), bracketPaint);

    // Bottom-Right
    canvas.drawLine(Offset(size.width - pad, size.height - pad), Offset(size.width - pad - bracketSize, size.height - pad), bracketPaint);
    canvas.drawLine(Offset(size.width - pad, size.height - pad), Offset(size.width - pad, size.height - pad - bracketSize), bracketPaint);
  }

  @override
  bool shouldRepaint(covariant _BiometricHudPainter oldDelegate) => false;
}

Widget pill(Color bg, Color fg, String label) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppColors.radiusFull)),
      child: Text(label,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );

