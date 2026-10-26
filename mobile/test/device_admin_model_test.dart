import 'package:face_absen_mobile/features/admin/devices/domain/device_admin_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AdminDevice trust metadata', () {
    test('parses score and maps level label', () {
      final AdminDevice device = AdminDevice.fromJson(<String, dynamic>{
        'id': 'd1',
        'status': 'ACTIVE',
        'platform': 'ANDROID',
        'employee': <String, dynamic>{'name': 'Siti', 'employeeNo': 'EMP-1'},
        'trustScore': 82,
        'trustLevel': 'HIGH',
      });

      expect(device.trustScore, 82);
      expect(device.trustLabel, 'Tinggi');
      expect(device.pending, isFalse);
    });

    test('defaults to low trust when server omits metadata', () {
      final AdminDevice device = AdminDevice.fromJson(<String, dynamic>{
        'id': 'd2',
        'status': 'PENDING',
        'platform': 'IOS',
      });

      expect(device.trustScore, 0);
      expect(device.trustLevel, 'LOW');
      expect(device.trustLabel, 'Rendah');
      expect(device.pending, isTrue);
    });
  });
}
