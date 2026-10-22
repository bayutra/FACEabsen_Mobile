import 'dart:math';

import 'package:face_absen_mobile/features/liveness/domain/liveness_engine.dart';
import 'package:flutter_test/flutter_test.dart';

FrameObservation f({double? l, double? r, double? yaw, DateTime? at}) =>
    FrameObservation(eyeOpenLeft: l, eyeOpenRight: r, yaw: yaw, at: at);

void main() {
  test('generateChallenges: random, non-repeating, Indonesian instructions', () {
    final a = generateChallenges(random: Random(1));
    final b = generateChallenges(random: Random(2));
    expect(a, hasLength(3));
    expect(a.toSet(), hasLength(3)); 
    expect(a == b, isFalse); 
    for (final c in ChallengeType.values) {
      expect(challengeInstruction(c).isNotEmpty, isTrue);
    }
    expect(challengeInstruction(ChallengeType.blink), contains('Kedip'));
  });

  test('blink completes on open → closed → open', () {
    final s = LivenessSession(challenges: const [ChallengeType.blink]);
    final t = DateTime(2026, 1, 1);
    expect(s.process(f(l: 0.9, r: 0.9, at: t)).name, LivenessStatus.inProgress.name);
    expect(s.process(f(l: 0.1, r: 0.1, at: t)).name, LivenessStatus.inProgress.name);
    expect(s.process(f(l: 0.9, r: 0.9, at: t)).name, LivenessStatus.allComplete.name);
    final att = s.toAttestation();
    expect(att['passed'], isTrue);
    expect((att['challenges'] as List), ['blink']);
  });

  test('photo stare (always open) never completes blink', () {
    final s = LivenessSession(challenges: const [ChallengeType.blink]);
    final t = DateTime(2026, 1, 1);
    for (var i = 0; i < 5; i++) {
      expect(
        s.process(f(l: 0.95, r: 0.95, at: t.add(Duration(seconds: i)))).name,
        LivenessStatus.inProgress.name,
      );
    }
  });

  test('turn left/right complete at ±20° yaw', () {
    final left = LivenessSession(challenges: const [ChallengeType.turnLeft]);
    final t = DateTime(2026, 1, 1);
    expect(left.process(f(yaw: -10, at: t)).name, LivenessStatus.inProgress.name);
    expect(left.process(f(yaw: -25, at: t)).name, LivenessStatus.allComplete.name);

    final right = LivenessSession(challenges: const [ChallengeType.turnRight]);
    expect(right.process(f(yaw: -25, at: t)).name, LivenessStatus.inProgress.name);
    expect(right.process(f(yaw: 25, at: t)).name, LivenessStatus.allComplete.name);
  });

  test('full random sequence completes in order with progress', () {
    final s = LivenessSession(challenges: const [
      ChallengeType.turnLeft,
      ChallengeType.blink,
      ChallengeType.turnRight,
    ]);
    final t = DateTime(2026, 1, 1);
    expect(s.progress, 0);
    expect(s.process(f(yaw: -30, at: t)).name, LivenessStatus.challengeComplete.name);
    expect(s.progress, closeTo(1 / 3, 1e-9));
    s.process(f(l: 0.9, r: 0.9, at: t));
    s.process(f(l: 0.1, r: 0.1, at: t));
    expect(s.process(f(l: 0.9, r: 0.9, at: t)).name, LivenessStatus.challengeComplete.name);
    expect(s.process(f(yaw: 30, at: t)).name, LivenessStatus.allComplete.name);
  });

  test('per-challenge timeout bounds replay attempts', () {
    final t = DateTime(2026, 1, 1);
    final s = LivenessSession(
      challenges: const [ChallengeType.blink],
      perChallengeTimeout: const Duration(seconds: 5),
      startedAt: t,
    );
    expect(
      s.process(f(l: 0.9, r: 0.9, at: t.add(const Duration(seconds: 6)))).name,
      LivenessStatus.timeout.name,
    );
  });

  test('null classification frames are ignored, not fatal', () {
    final s = LivenessSession(challenges: const [ChallengeType.turnLeft]);
    final t = DateTime(2026, 1, 1);
    expect(s.process(f(at: t)).name, LivenessStatus.inProgress.name);
    expect(s.process(f(yaw: -30, at: t)).name, LivenessStatus.allComplete.name);
  });
}
