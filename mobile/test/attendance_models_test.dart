import 'package:face_absen_mobile/features/attendance/data/attendance_repository.dart';
import 'package:face_absen_mobile/features/attendance/domain/attendance_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('sign message matches server format', () {
    expect(
      AttendanceRepository.signMessage('req-1', '2026-10-05T07:00:00.000Z'),
      'req-1.2026-10-05T07:00:00.000Z',
    );
  });

  test('check-in result parses + labels', () {
    final r = AttendanceResult.fromCheckIn({
      'id': 'a1',
      'workDate': '2026-10-05',
      'checkInAt': '2026-10-05T07:05:00.000Z',
      'checkInStatus': 'LATE',
      'shift': {'name': 'PAGI', 'window': '07:00 → 15:00'},
      'faceMatch': {'score': 0.87, 'matched': true},
      'risk': {'score': 96, 'category': 'LOW', 'needsReview': false},
    });
    expect(r.shiftLabel, 'PAGI · 07:00 → 15:00');
    expect(checkInStatusLabel(r.checkInStatus), 'Terlambat');
    expect(checkInStatusLabel('ON_TIME'), 'Tepat Waktu');
    expect(checkOutStatusLabel('EARLY_CHECKOUT'), 'Pulang Cepat');
    expect(r.riskScore, 96);
    expect(riskCategoryLabel(r.riskCategory), 'Risiko Rendah');
    expect(r.needsReview, isFalse);
  });

  test('rejection reasons map to Indonesian', () {
    expect(AttendanceRejected.fromResponse({'reason': 'DEVICE_NOT_ACTIVE'}).message,
        contains('tidak aktif'));
    expect(AttendanceRejected.fromResponse({'reason': 'FACE_MISMATCH'}).message,
        contains('tidak cocok'));
    expect(AttendanceRejected.fromResponse(null).message, 'Presensi ditolak.');
  });

  test('history page parses + query builder drops empties', () {
    final page = AttendanceHistoryPage.fromJson({
      'data': [
        {
          'id': 'a1',
          'workDate': '2026-10-05T00:00:00.000Z',
          'checkInAt': '2026-10-05T07:05:00.000Z',
          'checkInStatus': 'LATE',
          'checkOutAt': null,
          'checkOutStatus': null,
          'shift': {'name': 'PAGI', 'startTime': '07:00', 'endTime': '15:00', 'overnight': false},
          'riskScore': 85,
          'riskCategory': 'MEDIUM',
          'needsReview': true,
        },
      ],
      'pagination': {'page': 1, 'totalPages': 3, 'totalItems': 41},
    });
    expect(page.items, hasLength(1));
    expect(page.items.first.shiftWindow, '07:00 → 15:00');
    expect(page.items.first.needsReview, isTrue);
    expect(page.totalPages, 3);

    expect(toHistoryQueryString(), '');
    expect(toHistoryQueryString(page: 2, checkInStatus: 'LATE'), '?page=2&checkInStatus=LATE');
  });
}
