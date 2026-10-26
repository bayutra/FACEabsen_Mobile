import 'package:face_absen_mobile/core/config/app_version.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('app version comparison', () {
    test('equal versions compare as equal', () {
      expect(compareAppVersions('1.0.0', '1.0.0'), 0);
    });

    test('older patch is below', () {
      expect(compareAppVersions('1.0.0', '1.0.1'), lessThan(0));
    });

    test('newer minor is above', () {
      expect(compareAppVersions('1.2.0', '1.1.9'), greaterThan(0));
    });

    test('build suffix is ignored', () {
      expect(compareAppVersions('1.0.0+12', '1.0.0'), 0);
    });

    test('missing segments are padded with zero', () {
      expect(compareAppVersions('1.0', '1.0.0'), 0);
      expect(compareAppVersions('1', '1.0.0'), 0);
    });

    test('isAppVersionBelow is the reverse of comparison', () {
      expect(isAppVersionBelow('1.0.0', '1.0.1'), isTrue);
      expect(isAppVersionBelow('1.0.1', '1.0.0'), isFalse);
      expect(isAppVersionBelow('1.0.0', '1.0.0'), isFalse);
    });
  });
}
