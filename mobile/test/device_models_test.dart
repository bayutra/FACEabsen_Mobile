import 'package:face_absen_mobile/core/config/env.dart';
import 'package:face_absen_mobile/features/device/domain/device_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('status parsing covers PRD §10 + unknown', () {
    expect(deviceStatusFrom('PENDING'), DeviceStatus.pending);
    expect(deviceStatusFrom('ACTIVE'), DeviceStatus.active);
    expect(deviceStatusFrom('REVOKED'), DeviceStatus.revoked);
    expect(deviceStatusFrom('LOST'), DeviceStatus.lost);
    expect(deviceStatusFrom('REPLACED'), DeviceStatus.replaced);
    expect(deviceStatusFrom('HACKED'), DeviceStatus.unknown);
    expect(deviceStatusFrom(null), DeviceStatus.unknown);
  });

  test('every status has an Indonesian label', () {
    for (final s in DeviceStatus.values) {
      expect(deviceStatusLabel(s).isNotEmpty, isTrue);
    }
  });

  test('BoundDevice.fromJson tolerates partial payloads', () {
    final d = BoundDevice.fromJson({'id': 'd1'});
    expect(d.status, DeviceStatus.unknown);
    expect(d.installationId, '');
  });

  test('Env defaults point at local backend', () {
    expect(Env.apiBaseUrl, contains('/api/v1'));
    expect(Env.appName.isNotEmpty, isTrue);
  });

  test('change-request status labels + parsing', () {
    expect(changeRequestStatusFrom('PENDING'), ChangeRequestStatus.pending);
    expect(changeRequestStatusFrom('APPROVED'), ChangeRequestStatus.approved);
    expect(changeRequestStatusFrom('REJECTED'), ChangeRequestStatus.rejected);
    expect(changeRequestStatusFrom('CANCELLED'), ChangeRequestStatus.cancelled);
    expect(changeRequestStatusFrom('X'), ChangeRequestStatus.unknown);
    expect(changeRequestStatusLabel(ChangeRequestStatus.pending), 'Menunggu admin');
    final r = ChangeRequest.fromJson({'id': 'r1', 'status': 'PENDING', 'reason': 'BROKEN'});
    expect(r.id, 'r1');
    expect(r.reason, 'BROKEN');
  });
}
