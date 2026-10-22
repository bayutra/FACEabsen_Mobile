import 'dart:math' as math;

import 'package:face_absen_mobile/features/liveness/domain/passive_liveness.dart';
import 'package:flutter_test/flutter_test.dart';




PassiveFrame live(int i, {int count = 1}) => PassiveFrame(
      faceCount: count,
      relativeWidth: 0.22 + i * 0.05,
      yaw: 5,
      eyeOpenLeft: 0.7,
      eyeOpenRight: 0.72,
      landmarkX: 100 + (i.isEven ? 2.0 : -2.0),
      landmarkY: 100 + (i.isEven ? 1.5 : -1.5),
    );


PassiveFrame print_() => const PassiveFrame(
      faceCount: 1,
      relativeWidth: 0.4,
      yaw: 0,
      eyeOpenLeft: 0.95,
      eyeOpenRight: 0.95,
      landmarkX: 100,
      landmarkY: 100,
    );



PassiveFrame wobbledPrint(int i) => PassiveFrame(
      faceCount: 1,
      relativeWidth: 0.35,
      yaw: 2,
      eyeOpenLeft: 0.9,
      eyeOpenRight: 0.9,
      landmarkX: 100 + (i.isEven ? 2.0 : -2.0),
      landmarkY: 100 + (i.isEven ? 1.5 : -1.5),
    );


PassiveFrame approachingPrint(int i) => PassiveFrame(
      faceCount: 1,
      relativeWidth: 0.22 + i * 0.05,
      yaw: 0,
      eyeOpenLeft: 0.9,
      eyeOpenRight: 0.9,
      landmarkX: 100,
      landmarkY: 100,
    );

void main() {
  group('hard rejections', () {
    test('no face', () {
      final PassiveLiveness l = PassiveLiveness();
      final PassiveLivenessResult r = l.add(const PassiveFrame(
          faceCount: 0, relativeWidth: 0.4));
      expect(r.verdict, PassiveVerdict.rejected);
      expect(r.rejection!.code, 'NO_FACE');
    });

    test('more than one face', () {
      final PassiveLivenessResult r =
          PassiveLiveness().add(live(0, count: 2));
      expect(r.rejection!.code, 'MULTIPLE_FACES');
    });

    test('face too far away', () {
      final PassiveLivenessResult r = PassiveLiveness().add(const PassiveFrame(
          faceCount: 1, relativeWidth: 0.05, yaw: 0, eyeOpenLeft: .7, eyeOpenRight: .7));
      expect(r.rejection!.code, 'FACE_TOO_SMALL');
    });

    test('not frontal', () {
      final PassiveLivenessResult r = PassiveLiveness().add(const PassiveFrame(
          faceCount: 1, relativeWidth: .3, yaw: 45, eyeOpenLeft: .7, eyeOpenRight: .7));
      expect(r.rejection!.code, 'NOT_FRONTAIN');
    });

    test('eyes closed', () {
      final PassiveLivenessResult r = PassiveLiveness().add(const PassiveFrame(
          faceCount: 1, relativeWidth: .3, yaw: 0, eyeOpenLeft: .1, eyeOpenRight: .1));
      expect(r.rejection!.code, 'EYES_CLOSED');
    });
  });

  group('the anti-print signal', () {
    test('a perfectly rigid print never passes, no matter how many frames', () {
      final PassiveLiveness l = PassiveLiveness();
      PassiveVerdict last = PassiveVerdict.scanning;
      for (int i = 0; i < 30; i++) {
        last = l.add(print_()).verdict;
      }
      expect(last, isNot(PassiveVerdict.passed));
    });

    test('a live face with natural micro-motion passes after a few frames', () {
      final PassiveLiveness l = PassiveLiveness();
      PassiveVerdict last = PassiveVerdict.scanning;
      for (int i = 0; i < 6; i++) {
        last = l.add(live(i)).verdict;
      }
      expect(last, PassiveVerdict.passed);
    });

    test('a hand-wobbled print jitters but never changes distance: rejected', () {
      
      
      final PassiveLiveness l = PassiveLiveness();
      PassiveVerdict last = PassiveVerdict.scanning;
      for (int i = 0; i < 30; i++) {
        last = l.add(wobbledPrint(i)).verdict;
      }
      expect(last, isNot(PassiveVerdict.passed));
      
      
      expect(l.motionScore, greaterThan(0));
      expect(l.depthScore, 0);
    });

    test('a rigid photo slid toward the camera has depth but no motion: rejected', () {
      final PassiveLiveness l = PassiveLiveness();
      PassiveVerdict last = PassiveVerdict.scanning;
      for (int i = 0; i < 30; i++) {
        last = l.add(approachingPrint(i)).verdict;
      }
      expect(last, isNot(PassiveVerdict.passed));
      expect(l.depthScore, greaterThan(0));
      expect(l.motionScore, 0);
    });

    test('a passing run reports non-constant anti-spoof evidence', () {
      final PassiveLiveness l = PassiveLiveness();
      for (int i = 0; i < 6; i++) {
        l.add(live(i));
      }
      expect(l.motionScore, greaterThan(0));
      expect(l.depthScore, 1);
      expect(l.depthProgress, 1);
    });

    test('a still frame does not fail on its own — it keeps scanning', () {
      final PassiveLiveness l = PassiveLiveness();
      expect(l.add(print_()).verdict, PassiveVerdict.scanning);
    });

    test('subject swapping (huge jump) is not counted as micro-motion', () {
      final PassiveLiveness l = PassiveLiveness();
      l.add(live(0));
      final PassiveLivenessResult jumped = l.add(const PassiveFrame(
        faceCount: 1,
        relativeWidth: .35,
        yaw: 0,
        eyeOpenLeft: .7,
        eyeOpenRight: .7,
        landmarkX: 900,
        landmarkY: 900,
      ));
      expect(jumped.verdict, PassiveVerdict.scanning);
      expect(jumped.progress, lessThan(1));
    });
  });

  group('progression', () {
    test('progress climbs and reports total', () {
      final PassiveLiveness l = PassiveLiveness();
      expect(l.progress, 0);
      
      
      expect(l.add(live(0)).progress, 0);
      expect(l.add(live(1)).progress, greaterThan(0));
      for (int i = 2; i < 6; i++) {
        l.add(live(i));
      }
      expect(l.progress, 1);
    });

    test('a rejection resets the run so a lucky frame cannot pass', () {
      final PassiveLiveness l = PassiveLiveness();
      l.add(live(0));
      l.add(live(1));
      
      l.add(const PassiveFrame(faceCount: 0, relativeWidth: 0));
      expect(l.progress, 0);
    });

    test('reset clears accumulated motion evidence', () {
      final PassiveLiveness l = PassiveLiveness();
      l.add(live(0));
      l.reset();
      
      PassiveVerdict last = PassiveVerdict.scanning;
      for (int i = 0; i < 10; i++) {
        last = l.add(print_()).verdict;
      }
      expect(last, isNot(PassiveVerdict.passed));
    });
  });

  test('micro-motion thresholds exclude sub-pixel noise', () {
    
    final PassiveLiveness l = PassiveLiveness();
    PassiveVerdict last = PassiveVerdict.scanning;
    for (int i = 0; i < 20; i++) {
      last = l.add(PassiveFrame(
        faceCount: 1,
        relativeWidth: .35,
        yaw: 0,
        eyeOpenLeft: .7,
        eyeOpenRight: .7,
        landmarkX: 100 + (i.isEven ? 0.1 : -0.1),
        landmarkY: 100,
      )).verdict;
    }
    expect(last, isNot(PassiveVerdict.passed));
  });

  test('math import is used and policy is configurable', () {
    const PassivePolicy strict = PassivePolicy(requiredGoodFrames: 6);
    final PassiveLiveness l = PassiveLiveness(policy: strict);
    expect(l.policy.requiredGoodFrames, 6);
    expect(math.pi > 3, isTrue);
  });
}