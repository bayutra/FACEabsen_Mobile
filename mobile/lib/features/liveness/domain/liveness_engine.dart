import 'dart:math';

import 'eye_geometry.dart';

export 'eye_geometry.dart';

enum ChallengeType { blink, turnLeft, turnRight }

String challengeInstruction(ChallengeType type) {
  switch (type) {
    case ChallengeType.blink:
      return 'Kedipkan mata';
    case ChallengeType.turnLeft:
      return 'Tengok ke kiri';
    case ChallengeType.turnRight:
      return 'Tengok ke kanan';
  }
}

List<ChallengeType> generateChallenges({int count = 3, Random? random}) {
  final pool = List<ChallengeType>.of(ChallengeType.values)
    ..shuffle(random ?? Random.secure());
  return pool.take(count.clamp(1, ChallengeType.values.length)).toList();
}

class FrameObservation {
  FrameObservation({
    this.eyeOpenLeft,
    this.eyeOpenRight,
    this.yaw,
    this.eyeSource = EyeSignalSource.probability,
    DateTime? at,
  }) : at = at ?? DateTime.now();

  final double? eyeOpenLeft;
  final double? eyeOpenRight;
  final double? yaw;

  final EyeSignalSource eyeSource;

  final DateTime at;
}

enum LivenessStatus { inProgress, challengeComplete, allComplete, timeout }

class LivenessSession {
  LivenessSession({
    required this.challenges,
    this.perChallengeTimeout = const Duration(seconds: 10),
    this.overallTimeout = const Duration(seconds: 45),
    DateTime? startedAt,
  }) : _startedAt = startedAt ?? DateTime.now() {
    _challengeStartedAt = _startedAt;
  }

  final List<ChallengeType> challenges;
  final Duration perChallengeTimeout;
  final Duration overallTimeout;

  final DateTime _startedAt;
  late DateTime _challengeStartedAt;
  int index = 0;
  bool _blinkSawClosed = false;
  bool _blinkWasOpenFirst = false;
  DateTime? completedAt;

  ChallengeType get current => challenges[index];
  double get progress => challenges.isEmpty ? 1 : index / challenges.length;

  LivenessStatus process(FrameObservation obs) {
    if (completedAt != null) return LivenessStatus.allComplete;
    if (obs.at.difference(_startedAt) > overallTimeout ||
        obs.at.difference(_challengeStartedAt) > perChallengeTimeout) {
      return LivenessStatus.timeout;
    }
    if (_satisfied(current, obs)) {
      index++;
      _blinkSawClosed = false;
      _blinkWasOpenFirst = false;
      _challengeStartedAt = obs.at;
      if (index >= challenges.length) {
        completedAt = obs.at;
        return LivenessStatus.allComplete;
      }
      return LivenessStatus.challengeComplete;
    }
    return LivenessStatus.inProgress;
  }

  bool _satisfied(ChallengeType type, FrameObservation obs) {
    switch (type) {
      case ChallengeType.blink:
        return _blinkDone(obs);
      case ChallengeType.turnLeft:
        return obs.yaw != null && obs.yaw! <= -20;
      case ChallengeType.turnRight:
        return obs.yaw != null && obs.yaw! >= 20;
    }
  }

  bool _blinkDone(FrameObservation obs) {
    final double? l = obs.eyeOpenLeft;
    final double? r = obs.eyeOpenRight;
    if (l == null || r == null) return false;
    final BlinkThresholds t = BlinkThresholds.forSource(obs.eyeSource);
    final bool open = l > t.open && r > t.open;
    final bool closed = l < t.closed && r < t.closed;
    if (!_blinkWasOpenFirst) {
      if (open) _blinkWasOpenFirst = true;
      return false;
    }
    if (!_blinkSawClosed) {
      if (closed) _blinkSawClosed = true;
      return false;
    }
    return open;
  }

  Map<String, Object> toAttestation() {
    if (completedAt == null) throw StateError('Session not complete');
    return {
      'passed': true,
      'challenges': [for (final c in challenges) c.name],
      'completedAt': completedAt!.toIso8601String(),
      'score': 1.0,
      'sdk': 'mlkit',
    };
  }
}
