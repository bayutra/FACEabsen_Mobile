import 'package:face_absen_mobile/features/attendance/data/attendance_repository.dart';
import 'package:flutter_test/flutter_test.dart';

/// The server runs a global `ValidationPipe({ forbidNonWhitelisted: true })`,
/// so an unexpected key in the liveness object fails the whole punch with a
/// 400. These tests pin the exact wire shape for both modes.
void main() {
  const String now = '2026-10-07T07:00:00.000Z';

  group('active liveness (legacy challenge flow)', () {
    test('keeps the challenge list and sends no padScore', () {
      final Map<String, Object?> out = AttendanceRepository.livenessPayload(
        <String, Object>{
          'passed': true,
          'challenges': <String>['blink', 'turnLeft'],
          'completedAt': now,
          'score': 1.0,
        },
      );
      expect(out['mode'], 'active');
      expect(out['challenges'], <String>['blink', 'turnLeft']);
      expect(out.containsKey('padScore'), isFalse);
    });

    test('defaults to active when no mode is present', () {
      final Map<String, Object?> out = AttendanceRepository.livenessPayload(
        <String, Object>{
          'passed': true,
          'challenges': <String>['blink'],
          'completedAt': now,
          'score': 1.0,
        },
      );
      expect(out['mode'], 'active');
    });
  });

  group('passive liveness (Face-ID style)', () {
    test('drops challenges, sends mode and padScore', () {
      final Map<String, Object?> out = AttendanceRepository.livenessPayload(
        <String, Object>{
          'passed': true,
          'mode': 'passive',
          'completedAt': now,
          'score': 1.0,
          'padScore': 0.82,
        },
      );
      expect(out['mode'], 'passive');
      expect(out['padScore'], 0.82);
      // There are no commands to report; sending an empty array is also valid
      // but the key is dropped so the shape stays unambiguous.
      expect(out.containsKey('challenges'), isFalse);
    });

    test('the embedding rides along but is not sent inside liveness', () {
      final Map<String, Object?> out = AttendanceRepository.livenessPayload(
        <String, Object>{
          'passed': true,
          'mode': 'passive',
          'completedAt': now,
          'score': 1.0,
          'padScore': 0.9,
          'embedding': List<double>.filled(192, 0.1),
        },
      );
      // The embedding is a sibling of liveness in the payload, not a child.
      expect(out.containsKey('embedding'), isFalse);
    });

    test('omits padScore when it is absent rather than sending null', () {
      final Map<String, Object?> out = AttendanceRepository.livenessPayload(
        <String, Object>{
          'passed': true,
          'mode': 'passive',
          'completedAt': now,
          'score': 1.0,
        },
      );
      expect(out.containsKey('padScore'), isFalse);
    });

    test('never leaks a stray challenge list from the caller', () {
      // The scan screen would not send one, but a caller could.
      final Map<String, Object?> out = AttendanceRepository.livenessPayload(
        <String, Object>{
          'passed': true,
          'mode': 'passive',
          'challenges': <String>['blink'],
          'completedAt': now,
          'score': 1.0,
          'padScore': 0.7,
        },
      );
      expect(out.containsKey('challenges'), isFalse);
    });
  });

  test('every key we emit is one the server DTO declares', () {
    const Set<String> allowed = <String>{
      'passed',
      'challenges',
      'completedAt',
      'score',
      'mode',
      'padScore',
    };
    for (final Map<String, Object> input in <Map<String, Object>>[
      <String, Object>{
        'passed': true,
        'challenges': <String>['blink'],
        'completedAt': now,
        'score': 1.0,
      },
      <String, Object>{
        'passed': true,
        'mode': 'passive',
        'completedAt': now,
        'score': 1.0,
        'padScore': 0.8,
      },
    ]) {
      expect(AttendanceRepository.livenessPayload(input).keys.toSet().difference(allowed), isEmpty);
    }
  });
}
