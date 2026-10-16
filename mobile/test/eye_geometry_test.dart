import 'dart:math' as math;

import 'package:face_absen_mobile/features/liveness/domain/liveness_engine.dart';
import 'package:flutter_test/flutter_test.dart';

/// Synthetic closed-contour ring with a chosen aspect ratio (w:h).
List<EyePoint> ring(double cx, double cy, double width, double height, {int n = 12}) {
  return List<EyePoint>.generate(n, (i) {
    final double a = 2 * math.pi * i / n;
    return EyePoint(cx + (width / 2) * math.cos(a), cy + (height / 2) * math.sin(a));
  });
}

void main() {
  group('eyeOpenRatioFromLandmarks', () {
    test('an open eye scores higher than a closed one', () {
      final double open = eyeOpenRatioFromLandmarks(ring(100, 100, 40, 12))!;
      final double closed = eyeOpenRatioFromLandmarks(ring(100, 100, 40, 2))!;
      expect(open, greaterThan(closed));
      expect(open, closeTo(0.3, 0.02));
      expect(closed, lessThan(0.1));
    });

    test('ratio is scale-invariant (translation + size independent)', () {
      expect(
        eyeOpenRatioFromLandmarks(ring(50, 50, 30, 9)),
        eyeOpenRatioFromLandmarks(ring(800, 400, 30, 9)),
      );
    });

    test('too few points -> null (no signal beats a false reading)', () {
      expect(eyeOpenRatioFromLandmarks(const []), isNull);
      expect(eyeOpenRatioFromLandmarks(const [EyePoint(0, 0), EyePoint(1, 1)]), isNull);
    });

    test('degenerate contour (zero width or height) -> null', () {
      expect(eyeOpenRatioFromLandmarks(ring(10, 10, 0, 5)), isNull);
      expect(eyeOpenRatioFromLandmarks(ring(10, 10, 20, 0)), isNull);
    });

    test('non-finite coordinate -> null instead of NaN propagation', () {
      expect(eyeOpenRatioFromLandmarks(const [EyePoint(double.nan, 0), EyePoint(1, 1)]), isNull);
    });

    test('absurd contour is clamped to 0..1', () {
      expect(eyeOpenRatioFromLandmarks(ring(10, 10, 4, 400)), lessThanOrEqualTo(1.0));
    });
  });

  group('blink thresholds per signal source', () {
    test('probability scale keeps the Android contract (0.6 / 0.4)', () {
      final t = BlinkThresholds.forSource(EyeSignalSource.probability);
      expect(t.open, 0.6);
      expect(t.closed, 0.4);
    });

    test('landmark scale is the iOS aspect-ratio range', () {
      final t = BlinkThresholds.forSource(EyeSignalSource.landmarkRatio);
      expect(t.open, lessThan(BlinkThresholds.forProbability.open));
      expect(t.closed, lessThan(BlinkThresholds.forProbability.closed));
    });

    test('iOS blink completes on derived ratios end to end', () {
      final s = LivenessSession(challenges: const [ChallengeType.blink]);
      final t = DateTime(2026, 1, 1);
      FrameObservation o(double v) => FrameObservation(
            eyeOpenLeft: v,
            eyeOpenRight: v,
            eyeSource: EyeSignalSource.landmarkRatio,
            at: t,
          );

      expect(s.process(o(0.30)).name, LivenessStatus.inProgress.name);
      expect(s.process(o(0.03)).name, LivenessStatus.inProgress.name);
      expect(s.process(o(0.30)).name, LivenessStatus.allComplete.name);
      expect(s.toAttestation()['passed'], isTrue);
    });

    test('regression guard: iOS-scale values are NOT open on the probability scale', () {
      expect(
        0.30 > BlinkThresholds.forProbability.open,
        isFalse,
        reason: 'a 0.30 aspect ratio must not count as open on the probability scale',
      );
    });

    test('null eye signal is ignored: never advances, never fails', () {
      final s = LivenessSession(challenges: const [ChallengeType.blink]);
      expect(
        s.process(FrameObservation(eyeSource: EyeSignalSource.landmarkRatio, at: DateTime(2026, 1, 1))).name,
        LivenessStatus.inProgress.name,
      );
    });
  });
}