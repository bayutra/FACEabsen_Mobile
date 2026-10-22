import 'package:face_absen_mobile/features/schedule/domain/shift_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final DateTime workDate = DateTime(2026, 10, 6);

  ShiftVerdict checkInAt(int hour, int minute) => evaluateCheckInStatus(
        now: DateTime(2026, 10, 6, hour, minute),
        workDate: workDate,
        startTime: '07:00',
        gracePeriodMin: 15,
        lateThresholdMin: 30,
      );

  ShiftVerdict checkOutAt(int hour, int minute) => evaluateCheckOutStatus(
        now: DateTime(2026, 10, 6, hour, minute),
        workDate: workDate,
        startTime: '07:00',
        endTime: '15:00',
        earlyCheckoutThresholdMin: 15,
        overnight: false,
      );

  group('evaluateCheckInStatus (mirrors server evaluateCheckIn)', () {
    test('at the start is on time', () {
      final v = checkInAt(7, 0);
      expect(v.status, PunchStatus.onTime);
      expect(v.minutes, 0);
    });

    test('within the grace period is still on time', () {
      expect(checkInAt(7, 15).status, PunchStatus.onTime);
      expect(checkInAt(7, 15).minutes, 15);
    });

    test('past grace but within the late threshold is LATE', () {
      final v = checkInAt(7, 20);
      expect(v.status, PunchStatus.late);
      expect(v.minutes, 20);
    });

    test('beyond the late threshold is VERY_LATE', () {
      final v = checkInAt(7, 45);
      expect(v.status, PunchStatus.veryLate);
      expect(v.minutes, 45);
    });

    test('early arrival clamps to zero, never negative', () {
      final v = checkInAt(6, 40);
      expect(v.status, PunchStatus.onTime);
      expect(v.minutes, 0);
    });

    test('honours a custom grace/threshold pair', () {
      final v = evaluateCheckInStatus(
        now: DateTime(2026, 10, 6, 7, 25),
        workDate: workDate,
        startTime: '07:00',
        gracePeriodMin: 5,
        lateThresholdMin: 20,
      );
      expect(v.status, PunchStatus.veryLate);
      expect(v.minutes, 25);
    });
  });

  group('evaluateCheckOutStatus (mirrors server evaluateCheckOut)', () {
    test('leaving exactly at the end is a normal checkout', () {
      final v = checkOutAt(15, 0);
      expect(v.status, PunchStatus.normalCheckout);
      expect(v.minutes, 0);
    });

    test('leaving within the early threshold is still normal', () {
      expect(checkOutAt(14, 50).status, PunchStatus.normalCheckout);
      expect(checkOutAt(14, 50).minutes, 10);
    });

    test('leaving earlier than the threshold is EARLY_CHECKOUT', () {
      final v = checkOutAt(14, 30);
      expect(v.status, PunchStatus.earlyCheckout);
      expect(v.minutes, 30);
    });

    test('overnight shift anchors its end on the next day', () {
      final ShiftVerdict v = evaluateCheckOutStatus(
        now: DateTime(2026, 10, 7, 6, 50),
        workDate: DateTime(2026, 10, 6),
        startTime: '23:00',
        endTime: '07:00',
        earlyCheckoutThresholdMin: 15,
        overnight: true,
      );
      expect(v.status, PunchStatus.normalCheckout);
      expect(v.minutes, 10);
    });
  });

  group('minutesOfDay', () {
    test('parses valid HH:mm', () {
      expect(minutesOfDay('00:00'), 0);
      expect(minutesOfDay('07:30'), 450);
      expect(minutesOfDay('23:59'), 1439);
    });

    test('rejects malformed or out-of-range input', () {
      expect(minutesOfDay('7:00'), 420);
      expect(minutesOfDay('25:00'), isNull);
      expect(minutesOfDay('07:60'), isNull);
      expect(minutesOfDay('abc'), isNull);
      expect(minutesOfDay(''), isNull);
    });
  });
}
