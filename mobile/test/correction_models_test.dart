import 'package:face_absen_mobile/features/correction/domain/correction_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('combineWorkDateTime builds ISO or rejects', () {
    expect(combineWorkDateTime('2026-10-05', '07:05'), '2026-10-05T07:05:00.000Z');
    expect(combineWorkDateTime('2026-10-05', ''), isNull);
    expect(combineWorkDateTime('2026-10-05', '25:00'), isNull);
    expect(combineWorkDateTime('2026-10-05', '7:05'), isNull);
  });

  test('type labels cover PRD §36 + item parsing', () {
    expect(correctionTypes['MISSED_CHECK_IN'], 'Lupa Check-in');
    expect(correctionStatusLabels['PENDING'], 'Menunggu');
    final item = CorrectionItem.fromJson({
      'id': 'c1',
      'status': 'PENDING',
      'type': 'WRONG_TIME',
      'reason': 'salah jam',
      'requestedCheckIn': '2026-10-05T07:10:00.000Z',
      'attendance': {'workDate': '2026-10-05T00:00:00.000Z'},
    });
    expect(item.workDate, '2026-10-05');
    expect(item.requestedCheckOut, isNull);
  });
}
