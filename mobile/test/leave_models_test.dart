import 'package:face_absen_mobile/features/leave/domain/leave_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('date helpers validate ranges', () {
    expect(toDateKey(DateTime(2026, 1, 5)), '2026-01-05');
    expect(validLeaveRange('2026-10-10', '2026-10-12'), isTrue);
    expect(validLeaveRange('2026-10-12', '2026-10-10'), isFalse);
    expect(validLeaveRange('2026-10-10', '2026-10-10'), isTrue);
    expect(leaveDays('2026-10-10', '2026-10-12'), 3);
    expect(leaveDays('2026-10-10', '2026-10-10'), 1);
  });

  test('type labels cover PRD §37 + item parsing', () {
    expect(leaveTypes['CUTI'], 'Cuti Tahunan');
    expect(leaveStatusLabels['APPROVED'], 'Disetujui');
    final item = LeaveItem.fromJson({
      'id': 'l1',
      'status': 'PENDING',
      'type': 'SAKIT',
      'startDate': '2026-12-01T00:00:00.000Z',
      'endDate': '2026-12-02T00:00:00.000Z',
      'reason': 'demam',
    });
    expect(item.startDate, '2026-12-01');
    expect(item.reviewNote, isNull);
  });
}
