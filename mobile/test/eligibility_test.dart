import 'package:face_absen_mobile/features/preflight/domain/eligibility.dart';
import 'package:face_absen_mobile/features/schedule/data/schedule_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('account gate', () {
    test('active profile passes with role chips', () {
      final GateResult g = evaluateAccount(isActive: true, hasProfile: true);
      expect(g.state, GateState.pass);
      expect(g.badge, 'Aktif');
      expect(g.chips, isNotEmpty);
    });

    test('missing employee profile fails (this is a real block, not a warning)',
        () {
      expect(evaluateAccount(isActive: true, hasProfile: false).state,
          GateState.fail);
    });

    test('deactivated account fails', () {
      final GateResult g = evaluateAccount(isActive: false, hasProfile: true);
      expect(g.state, GateState.fail);
      expect(g.badge, 'Nonaktif');
    });
  });

  group('which gates actually block the punch', () {
    test('account and schedule block; both are real server-side requirements',
        () {
      expect(isBlocking(evaluateAccount(isActive: true, hasProfile: true)),
          isTrue);
      expect(isBlocking(evaluateSchedule(hasShift: true)), isTrue);
    });

    test('two passing gates let the punch proceed', () {
      final List<GateResult> g = [
        evaluateAccount(isActive: true, hasProfile: true),
        evaluateSchedule(hasShift: true, window: '07:00 → 15:00'),
      ];
      expect(blockingGates(g), isEmpty);
      expect(canProceed(g), isTrue);
    });
  });

  group('schedule gate', () {
    test('roster row passes and shows the window', () {
      final GateResult g = evaluateSchedule(
          hasShift: true, window: '07:00 → 15:00', name: 'PAGI');
      expect(g.state, GateState.pass);
      expect(g.detail, contains('PAGI'));
      expect(g.detail, contains('07:00'));
    });

    test('no roster fails', () {
      expect(evaluateSchedule(hasShift: false).state, GateState.fail);
    });
  });

  group('schedule gate reflects the shift tolerances', () {
    ScheduleEntry shift() => ScheduleEntry.fromJson({
          'id': 'sch1',
          'workDate': '2026-10-06T00:00:00.000Z',
          'shift': {
            'name': 'PAGI',
            'startTime': '07:00',
            'endTime': '15:00',
            'overnight': false,
            'gracePeriodMin': 15,
            'lateThresholdMin': 30,
            'earlyCheckoutThresholdMin': 15,
          },
        });

    GateResult at(DateTime now) => evaluateSchedule(
          hasShift: true,
          window: '07:00 → 15:00',
          name: 'PAGI',
          shift: shift(),
          now: now,
        );

    test('on time stays a passing gate and shows the tolerances', () {
      final GateResult g = at(DateTime(2026, 10, 6, 7, 5));
      expect(g.state, GateState.pass);
      expect(g.badge, 'Tepat Waktu');
      expect(g.detail, contains('Toleransi 15'));
      expect(g.detail, contains('Ambang telat 30'));
    });

    test('late warns without blocking, and shows the late minutes', () {
      final GateResult g = at(DateTime(2026, 10, 6, 7, 20));
      expect(g.state, GateState.warn);
      expect(g.badge, 'Terlambat');
      expect(g.detail, contains('20'));
      expect(blockingGates([g]), isEmpty);
      expect(
        canProceed([evaluateAccount(isActive: true, hasProfile: true), g]),
        isTrue,
      );
    });

    test('beyond the late threshold is very late but still non-blocking', () {
      final GateResult g = at(DateTime(2026, 10, 6, 8, 0));
      expect(g.state, GateState.warn);
      expect(g.badge, 'Sangat Terlambat');
      expect(g.detail, contains('ambang telat 30'));
    });
  });

  group('roll-up', () {
    List<GateResult> allPass() => [
          evaluateAccount(isActive: true, hasProfile: true),
          evaluateSchedule(hasShift: true, window: '07:00 → 15:00'),
        ];

    test('all passing allows the punch', () {
      expect(canProceed(allPass()), isTrue);
      expect(passedCount(allPass()), 2);
    });

    test('one failure blocks the punch even if the rest pass', () {
      final List<GateResult> g = allPass();
      g[1] = evaluateSchedule(hasShift: false);
      expect(canProceed(g), isFalse);
      expect(blockingGates(g), hasLength(1));
    });
  });
}
