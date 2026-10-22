import 'package:face_absen_mobile/features/schedule/data/schedule_repository.dart';
import 'package:face_absen_mobile/features/schedule/domain/shift_status.dart';
import 'package:flutter_test/flutter_test.dart';

ScheduleEntry entry(String start, String end,
        {bool overnight = false, String name = 'SHIFT'}) =>
    ScheduleEntry.fromJson({
      'id': 'sch1',
      'workDate': '2026-10-06T00:00:00.000Z',
      'shift': {
        'name': name,
        'startTime': start,
        'endTime': end,
        'overnight': overnight,
      },
    });

void main() {
  group('ScheduleEntry parsing', () {
    test('reads shift context from the nested payload', () {
      final e = entry('07:00', '15:00', name: 'PAGI');
      expect(e.shiftName, 'PAGI');
      expect(e.startTime, '07:00');
      expect(e.endTime, '15:00');
      expect(e.window, '07:00 → 15:00');
      expect(e.overnight, isFalse);
    });

    test('survives a missing shift block without throwing', () {
      final e = ScheduleEntry.fromJson(
          {'id': 'x', 'workDate': '2026-10-06T00:00:00.000Z'});
      expect(e.shiftName, '—');
      expect(e.window, '--:-- → --:--');
    });

    test('dateKey zero-pads single digits', () {
      expect(ScheduleRepository.dateKey(DateTime(2026, 1, 5)), '2026-01-05');
      expect(ScheduleRepository.dateKey(DateTime(2026, 12, 31)), '2026-12-31');
    });

    test('reads shift tolerances, defaulting when the backend omits them', () {
      final withThresholds = ScheduleEntry.fromJson({
        'id': 'sch1',
        'workDate': '2026-10-06T00:00:00.000Z',
        'shift': {
          'name': 'PAGI',
          'startTime': '07:00',
          'endTime': '15:00',
          'overnight': false,
          'gracePeriodMin': 10,
          'lateThresholdMin': 45,
          'earlyCheckoutThresholdMin': 20,
        },
      });
      expect(withThresholds.gracePeriodMin, 10);
      expect(withThresholds.lateThresholdMin, 45);
      expect(withThresholds.earlyCheckoutThresholdMin, 20);

      final defaults = entry('07:00', '15:00');
      expect(defaults.gracePeriodMin, 15);
      expect(defaults.lateThresholdMin, 30);
      expect(defaults.earlyCheckoutThresholdMin, 15);
    });

    test('checkInStatusAt/checkOutStatusAt use the parsed tolerances', () {
      final e = ScheduleEntry.fromJson({
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
      expect(e.checkInStatusAt(DateTime(2026, 10, 6, 7, 20)).status,
          PunchStatus.late);
      expect(e.checkOutStatusAt(DateTime(2026, 10, 6, 14, 30)).status,
          PunchStatus.earlyCheckout);
    });
  });

  group('shift kind drives the badge', () {
    test('morning, afternoon and night are classified correctly', () {
      expect(entry('07:00', '15:00').kind, ShiftKind.pagi);
      expect(entry('14:00', '22:00').kind, ShiftKind.siang);
      expect(entry('22:00', '06:00', overnight: true).kind, ShiftKind.malam);
    });

    test('boundary hours map to the expected kind', () {
      expect(entry('13:59', '21:59').kind, ShiftKind.pagi);
      expect(entry('14:00', '22:00').kind, ShiftKind.siang);

      expect(entry('10:00', '06:00', overnight: true).kind, ShiftKind.malam);
    });

    test('malformed or out-of-range times degrade to morning, never to night',
        () {
      expect(entry('abc', 'def').kind, ShiftKind.pagi);
      expect(entry('', '').kind, ShiftKind.pagi);
      expect(entry('99:99', '99:99').kind, ShiftKind.pagi);
    });

    test('valid early-morning window is not mistaken for a night shift', () {
      expect(entry('00:00', '08:00').kind, ShiftKind.pagi);
    });
  });
}
