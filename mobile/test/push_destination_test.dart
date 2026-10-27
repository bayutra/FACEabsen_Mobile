import 'package:face_absen_mobile/features/notifications/domain/push_destination.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps backend types to screens', () {
    final PushDestination correction = PushDestination.fromData(
      <String, dynamic>{
        'type': 'correction',
        'id': 'c1',
        'status': 'APPROVED',
      },
    );
    expect(correction.target, PushTarget.correction);
    expect(correction.id, 'c1');
    expect(correction.status, 'APPROVED');

    expect(
      PushDestination.fromData(<String, dynamic>{'type': 'leave'}).target,
      PushTarget.leave,
    );
    expect(
      PushDestination.fromData(<String, dynamic>{'type': 'device'}).target,
      PushTarget.device,
    );
    expect(
      PushDestination.fromData(<String, dynamic>{'type': 'handover'}).target,
      PushTarget.handover,
    );
    expect(
      PushDestination.fromData(<String, dynamic>{'type': 'attendance'}).target,
      PushTarget.attendance,
    );
  });

  test('unknown or empty payloads fall back to unknown', () {
    expect(
      PushDestination.fromData(<String, dynamic>{'type': 'mystery'}).target,
      PushTarget.unknown,
    );
    expect(
      PushDestination.fromData(<String, dynamic>{}).target,
      PushTarget.unknown,
    );
  });
}
