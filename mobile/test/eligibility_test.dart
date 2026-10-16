import 'package:face_absen_mobile/features/preflight/domain/eligibility.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('account gate', () {
    test('active profile passes with role chips', () {
      final GateResult g = evaluateAccount(isActive: true, hasProfile: true);
      expect(g.state, GateState.pass);
      expect(g.badge, 'Aktif');
      expect(g.chips, isNotEmpty);
    });

    test('missing employee profile fails (this is a real block, not a warning)', () {
      expect(evaluateAccount(isActive: true, hasProfile: false).state, GateState.fail);
    });

    test('deactivated account fails', () {
      final GateResult g = evaluateAccount(isActive: false, hasProfile: true);
      expect(g.state, GateState.fail);
      expect(g.badge, 'Nonaktif');
    });
  });

  group('accuracy gate (tolerance $kMaxAccuracyMeters m)', () {
    test('tight fix is optimal, mid is a warning, poor fix warns too', () {
      expect(evaluateAccuracy(8).state, GateState.pass);
      expect(evaluateAccuracy(8).badge, 'Optimal');
      expect(evaluateAccuracy(30).badge, 'Cukup');
      expect(evaluateAccuracy(30).state, GateState.warn);
      // A poor fix must NOT block the punch: the server re-validates accuracy.
      expect(evaluateAccuracy(120).state, GateState.warn);
      expect(evaluateAccuracy(120).badge, 'Lemah');
    });

    test('boundary: exactly at the limit is usable, one metre over warns', () {
      expect(evaluateAccuracy(kMaxAccuracyMeters.toDouble()).state, GateState.warn);
      expect(evaluateAccuracy(kMaxAccuracyMeters + 1).state, GateState.warn);
    });

    test('no fix at all warns rather than failing', () {
      final GateResult g = evaluateAccuracy(null);
      expect(g.state, GateState.warn);
      expect(g.badge, 'Tidak Ada');
    });
  });

  group('which gates actually block the punch', () {
    test('accuracy is advisory; account/geofence/schedule are blocking', () {
      expect(isBlocking(evaluateAccuracy(500)), isFalse);
      expect(isBlocking(evaluateAccount(isActive: true, hasProfile: true)), isTrue);
      expect(isBlocking(evaluateGeofence(
          inside: true, distanceM: 5, mockSuspected: false)), isTrue);
      expect(isBlocking(evaluateSchedule(hasShift: true)), isTrue);
    });

    test('a bad GPS fix cannot block attendance', () {
      final List<GateResult> g = [
        evaluateAccount(isActive: true, hasProfile: true),
        evaluateAccuracy(500),
        evaluateGeofence(inside: true, distanceM: 12, mockSuspected: false),
        evaluateSchedule(hasShift: true, window: '07:00 → 15:00'),
      ];
      expect(blockingGates(g), isEmpty);
      expect(canProceed(g), isTrue);
    });

    test('missing fix and a weak fix both stay out of the blocking list', () {
      expect(blockingGates([evaluateAccuracy(null)]), isEmpty);
      expect(blockingGates([evaluateAccuracy(999)]), isEmpty);
    });
  });

  group('geofence gate', () {
    test('inside radius passes and reports the distance', () {
      final GateResult g =
          evaluateGeofence(inside: true, distanceM: 18, mockSuspected: false);
      expect(g.state, GateState.pass);
      expect(g.badge, 'Dalam Radius Sah');
      expect(g.detail, contains('18 meter'));
    });

    test('outside radius fails', () {
      expect(
        evaluateGeofence(inside: false, distanceM: 420, mockSuspected: false).state,
        GateState.fail,
      );
    });

    test('mock location outranks everything — it is never merely a warning', () {
      // Even a fix that claims to be inside must not pass when the server
      // suspects a fake GPS provider.
      final GateResult g =
          evaluateGeofence(inside: true, distanceM: 5, mockSuspected: true);
      expect(g.state, GateState.fail);
      expect(g.badge, 'Lokasi Palsu');
    });

    test('pending verdict warns instead of failing', () {
      final GateResult g = evaluateGeofence(inside: null, distanceM: null, mockSuspected: null);
      expect(g.state, GateState.warn);
    });
  });

  group('schedule gate', () {
    test('roster row passes and shows the window', () {
      final GateResult g =
          evaluateSchedule(hasShift: true, window: '07:00 → 15:00', name: 'PAGI');
      expect(g.state, GateState.pass);
      expect(g.detail, contains('PAGI'));
      expect(g.detail, contains('07:00'));
    });

    test('no roster fails', () {
      expect(evaluateSchedule(hasShift: false).state, GateState.fail);
    });
  });

  group('roll-up', () {
    List<GateResult> allPass() => [
          evaluateAccount(isActive: true, hasProfile: true),
          evaluateAccuracy(8),
          evaluateGeofence(inside: true, distanceM: 12, mockSuspected: false),
          evaluateSchedule(hasShift: true, window: '07:00 → 15:00'),
        ];

    test('all four passing allows the punch', () {
      expect(canProceed(allPass()), isTrue);
      expect(passedCount(allPass()), 4);
    });

    test('a single warning still allows the punch', () {
      final List<GateResult> g = allPass();
      g[1] = evaluateAccuracy(30); // warn band, still usable
      expect(canProceed(g), isTrue);
      expect(passedCount(g), 3);
    });

    test('one failure blocks the punch even if the rest pass', () {
      final List<GateResult> g = allPass();
      g[3] = evaluateSchedule(hasShift: false);
      expect(canProceed(g), isFalse);
    });

    test('mock GPS blocks the punch even with a perfect schedule', () {
      final List<GateResult> g = allPass();
      g[2] = evaluateGeofence(inside: true, distanceM: 5, mockSuspected: true);
      expect(canProceed(g), isFalse);
    });
  });
}