import 'dart:math';

import 'eye_geometry.dart';

export 'eye_geometry.dart';

/// STEP 10 — liveness challenge engine (PRD §14, §55). Pure + unit-tested.
///
/// Threat model: static photo, screenshot-of-face, and generic replay video
/// are defeated by unpredictable challenge-response (blink + head turns with
/// per-challenge timeouts). No biometric pixels are stored here.
///
/// The passing session produces an attestation map consumed by the attendance
/// engine (STEP 12) and risk engine (STEP 13).
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

/// Random, non-repeating challenge sequence. A fresh shuffle every session
/// means a pre-recorded video cannot match the prompt order.
List<ChallengeType> generateChallenges({int count = 3, Random? random}) {
  final pool = List<ChallengeType>.of(ChallengeType.values)..shuffle(random ?? Random.secure());
  return pool.take(count.clamp(1, ChallengeType.values.length)).toList();
}

/// One analyzed frame: ML Kit eye-open probabilities (0..1, null when
/// classification unavailable) and head yaw in degrees.
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

  /// Which scale [eyeOpenLeft]/[eyeOpenRight] are expressed in. iOS supplies
  /// landmark-derived ratios instead of classifier probabilities.
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

  /// open → closed → open. Frames without classification are ignored
  /// (they neither advance nor reset the phase).
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

  /// Attestation for the attendance/risk engines (STEP 12/13).
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
