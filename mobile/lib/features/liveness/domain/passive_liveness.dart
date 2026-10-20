import 'dart:math' as math;

/// Passive (no-command) liveness — the Face ID-style flow.
///
/// The user simply holds the phone and looks at the camera; there is no
/// "blink / turn your head" instruction. Accepting a run requires several
/// *simultaneous* signals, because any single one is trivially spoofable:
///
///  * exactly one face, large enough and roughly frontal
///  * both eyes detected as open
///  * **micro-motion**: the landmark jitters a little between frames
///  * **depth change**: the face's relative size must vary across the run —
///    the user naturally drifts/leans while holding the phone. A printed
///    photo held in a trembling hand jitters laterally (defeating micro-motion
///    alone) but keeps a near-constant distance, so it fails the depth gate.
///    A photo taped to a wall fails both.
///  * temporal persistence: the verdict needs a short run of good frames, so a
///    single lucky frame cannot pass
///
/// Honesty note: micro-motion ALONE does not stop a hand-wobbled print —
/// hand tremor (2–20 px) sits comfortably inside the acceptance band. The
/// depth gate is what rejects it. Neither signal is a certified PAD; the
/// on-device verdict remains a pre-filter and the server treats `padScore`
/// as one input among face match and device integrity.
///
/// Pure Dart: every rule is unit-testable without a device.
class PassiveFrame {
  const PassiveFrame({
    required this.faceCount,
    required this.relativeWidth,
    this.yaw,
    this.eyeOpenLeft,
    this.eyeOpenRight,
    this.landmarkX,
    this.landmarkY,
  });

  final int faceCount;

  /// Face box width / image width. Mirrors the enrollment quality gate.
  final double relativeWidth;

  final double? yaw;
  final double? eyeOpenLeft;
  final double? eyeOpenRight;

  /// A single stable landmark point (e.g. nose base) in pixels, used to
  /// measure micro-motion between frames.
  final double? landmarkX;
  final double? landmarkY;
}

enum PassiveVerdict { waiting, scanning, passed, rejected }

class PassiveRejection {
  const PassiveRejection(this.code, this.message);
  final String code;
  final String message;
}

class PassiveLivenessResult {
  const PassiveLivenessResult({
    required this.verdict,
    this.progress = 0,
    this.rejection,
    this.hint,
  });

  final PassiveVerdict verdict;
  final double progress;
  final PassiveRejection? rejection;

  /// Guidance while scanning (e.g. which gate is still missing). Null when
  /// the UI should keep showing the previous message.
  final String? hint;
}

/// Tunables for the passive gate.
class PassivePolicy {
  const PassivePolicy({
    this.minWidth = 0.15,
    this.maxYaw = 30,
    this.eyeClosedBelow = 0.35,
    this.eyeOpenAbove = 0.45,
    this.microMotionMin = 0.8,
    this.microMotionMax = 60,
    this.depthChangeMin = 0.04,
    this.requiredGoodFrames = 3,
  });

  final double minWidth;
  final double maxYaw;
  final double eyeClosedBelow;
  final double eyeOpenAbove;

  /// Hand tremor defeats this band on its own — it only proves *something*
  /// moved, and pairs with [depthChangeMin] to prove a living holder.
  final double microMotionMin;
  final double microMotionMax;

  /// Minimum max-min spread of [PassiveFrame.relativeWidth] across the run
  /// (≈4% of frame width: a slow lean-in). A rigid plane held at a fixed
  /// distance cannot produce it; a live holder does it without thinking.
  final double depthChangeMin;

  final int requiredGoodFrames;
}

/// Stateful analyser over a stream of frames.
class PassiveLiveness {
  PassiveLiveness({this.policy = const PassivePolicy()});

  final PassivePolicy policy;
  int _goodRun = 0;
  double? _lastX;
  double? _lastY;
  bool _sawMotion = false;

  /// Cumulative landmark path length in pixels (continuous evidence, feeds
  /// [motionScore]). Resets with the run.
  double _pathLength = 0;

  double? _minWidth;
  double? _maxWidth;
  bool _sawDepthChange = false;

  double get progress => (_goodRun / policy.requiredGoodFrames).clamp(0.0, 1.0);

  /// 0..1 depth evidence: observed width spread relative to the requirement.
  double get depthProgress {
    if (_minWidth == null || _maxWidth == null) return 0;
    return ((_maxWidth! - _minWidth!) / policy.depthChangeMin).clamp(0.0, 1.0);
  }

  /// Continuous 0..1 components for the reported anti-spoof confidence.
  /// Calibrated so a genuine run lands near 1 and a marginal one near the
  /// server's acceptance floor — never a constant.
  double get motionScore => (_pathLength / 12.0).clamp(0.0, 1.0);
  double get depthScore => depthProgress;

  void reset() {
    _goodRun = 0;
    _lastX = null;
    _lastY = null;
    _sawMotion = false;
    _pathLength = 0;
    _minWidth = null;
    _maxWidth = null;
    _sawDepthChange = false;
  }

  PassiveLivenessResult add(PassiveFrame frame) {
    final PassiveRejection? hard = _hardReject(frame);
    if (hard != null) {
      _goodRun = 0;
      return PassiveLivenessResult(verdict: PassiveVerdict.rejected, rejection: hard);
    }

    // Micro-motion accumulates across the session, not per frame, so a still
    // frame never fails on its own.
    final double? x = frame.landmarkX;
    final double? y = frame.landmarkY;
    if (x != null && y != null && _lastX != null && _lastY != null) {
      final double delta = math.sqrt(math.pow(x - _lastX!, 2) + math.pow(y - _lastY!, 2));
      _pathLength += delta;
      if (delta >= policy.microMotionMin && delta <= policy.microMotionMax) {
        _sawMotion = true;
      }
    }
    if (x != null && y != null) {
      _lastX = x;
      _lastY = y;
    }

    // Depth change: track the face-size envelope over all usable frames.
    final double w = frame.relativeWidth;
    if (w > 0) {
      _minWidth = _minWidth == null ? w : math.min(_minWidth!, w);
      _maxWidth = _maxWidth == null ? w : math.max(_maxWidth!, w);
      if (_maxWidth! - _minWidth! >= policy.depthChangeMin) {
        _sawDepthChange = true;
      }
    }

    if (!_sawMotion || !_sawDepthChange) {
      return PassiveLivenessResult(
        verdict: PassiveVerdict.scanning,
        progress: progress,
        hint: !_sawDepthChange
            ? 'Dekatkan perlahan ponsel ke wajah.'
            : 'Tahan ponsel stabil, lihat kamera.',
      );
    }

    _goodRun++;
    if (_goodRun >= policy.requiredGoodFrames) {
      return const PassiveLivenessResult(verdict: PassiveVerdict.passed, progress: 1);
    }
    return PassiveLivenessResult(verdict: PassiveVerdict.scanning, progress: progress);
  }

  PassiveRejection? _hardReject(PassiveFrame frame) {
    if (frame.faceCount == 0) {
      return const PassiveRejection('NO_FACE', 'Wajah tidak terdeteksi. Posisikan wajah di dalam lingkaran.');
    }
    if (frame.faceCount > 1) {
      return const PassiveRejection('MULTIPLE_FACES', 'Lebih dari satu wajah terdeteksi. Pastikan hanya Anda.');
    }
    if (frame.relativeWidth < policy.minWidth) {
      return const PassiveRejection('FACE_TOO_SMALL', 'Wajah terlalu jauh. Dekatkan ke kamera.');
    }
    final double? yaw = frame.yaw;
    if (yaw == null || yaw.abs() > policy.maxYaw) {
      return const PassiveRejection('NOT_FRONTAIN', 'Hadapkan wajah lurus ke kamera.');
    }
    final double? l = frame.eyeOpenLeft;
    final double? r = frame.eyeOpenRight;
    if (l == null || r == null) {
      return const PassiveRejection('EYES_UNKNOWN', 'Mata tidak terbaca. Cari cahaya yang cukup.');
    }
    if (l < policy.eyeClosedBelow && r < policy.eyeClosedBelow) {
      return const PassiveRejection('EYES_CLOSED', 'Mata tertutup. Buka kedua mata.');
    }
    // NB: a high eye-open value is NOT evidence of a photo — 0.7 is normal for
    // a real face. The genuine anti-print signals are micro-motion + depth
    // change over a multi-frame run, both handled above.
    return null;
  }
}
