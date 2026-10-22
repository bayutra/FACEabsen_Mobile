import 'dart:math' as math;

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

  final double relativeWidth;

  final double? yaw;
  final double? eyeOpenLeft;
  final double? eyeOpenRight;

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

  final String? hint;
}

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

  final double microMotionMin;
  final double microMotionMax;

  final double depthChangeMin;

  final int requiredGoodFrames;
}

class PassiveLiveness {
  PassiveLiveness({this.policy = const PassivePolicy()});

  final PassivePolicy policy;
  int _goodRun = 0;
  double? _lastX;
  double? _lastY;
  bool _sawMotion = false;

  double _pathLength = 0;

  double? _minWidth;
  double? _maxWidth;
  bool _sawDepthChange = false;

  double get progress => (_goodRun / policy.requiredGoodFrames).clamp(0.0, 1.0);

  double get depthProgress {
    if (_minWidth == null || _maxWidth == null) return 0;
    return ((_maxWidth! - _minWidth!) / policy.depthChangeMin).clamp(0.0, 1.0);
  }

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
      return PassiveLivenessResult(
          verdict: PassiveVerdict.rejected, rejection: hard);
    }

    final double? x = frame.landmarkX;
    final double? y = frame.landmarkY;
    if (x != null && y != null && _lastX != null && _lastY != null) {
      final double delta =
          math.sqrt(math.pow(x - _lastX!, 2) + math.pow(y - _lastY!, 2));
      _pathLength += delta;
      if (delta >= policy.microMotionMin && delta <= policy.microMotionMax) {
        _sawMotion = true;
      }
    }
    if (x != null && y != null) {
      _lastX = x;
      _lastY = y;
    }

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
      return const PassiveLivenessResult(
          verdict: PassiveVerdict.passed, progress: 1);
    }
    return PassiveLivenessResult(
        verdict: PassiveVerdict.scanning, progress: progress);
  }

  PassiveRejection? _hardReject(PassiveFrame frame) {
    if (frame.faceCount == 0) {
      return const PassiveRejection('NO_FACE',
          'Wajah tidak terdeteksi. Posisikan wajah di dalam lingkaran.');
    }
    if (frame.faceCount > 1) {
      return const PassiveRejection('MULTIPLE_FACES',
          'Lebih dari satu wajah terdeteksi. Pastikan hanya Anda.');
    }
    if (frame.relativeWidth < policy.minWidth) {
      return const PassiveRejection(
          'FACE_TOO_SMALL', 'Wajah terlalu jauh. Dekatkan ke kamera.');
    }
    final double? yaw = frame.yaw;
    if (yaw == null || yaw.abs() > policy.maxYaw) {
      return const PassiveRejection(
          'NOT_FRONTAIN', 'Hadapkan wajah lurus ke kamera.');
    }
    final double? l = frame.eyeOpenLeft;
    final double? r = frame.eyeOpenRight;
    if (l == null || r == null) {
      return const PassiveRejection(
          'EYES_UNKNOWN', 'Mata tidak terbaca. Cari cahaya yang cukup.');
    }
    if (l < policy.eyeClosedBelow && r < policy.eyeClosedBelow) {
      return const PassiveRejection(
          'EYES_CLOSED', 'Mata tertutup. Buka kedua mata.');
    }

    return null;
  }
}
