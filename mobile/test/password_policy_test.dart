import 'package:face_absen_mobile/core/validation/password_policy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('validateNewPassword', () {
    test('empty is required', () {
      expect(validateNewPassword(null), 'Password baru wajib diisi.');
      expect(validateNewPassword(''), 'Password baru wajib diisi.');
    });

    test('rejects shorter than 8 chars', () {
      expect(validateNewPassword('Ab1'), 'Password baru minimal 8 karakter.');
      expect(
        validateNewPassword('Abcdef1'),
        'Password baru minimal 8 karakter.',
      );
    });

    test('rejects missing lowercase', () {
      expect(
        validateNewPassword('ABCDEFG1'),
        'Password baru wajib mengandung huruf kecil.',
      );
    });

    test('rejects missing uppercase', () {
      expect(
        validateNewPassword('abcdefg1'),
        'Password baru wajib mengandung huruf besar.',
      );
    });

    test('rejects missing digit', () {
      expect(
        validateNewPassword('Abcdefgh'),
        'Password baru wajib mengandung angka.',
      );
    });

    test('accepts policy-compliant passwords', () {
      expect(validateNewPassword('Abcdefg1'), isNull);
      expect(validateNewPassword('Strong123!'), isNull);
    });
  });

  group('validateCurrentPassword', () {
    test('empty is required, anything else passes', () {
      expect(validateCurrentPassword(null), 'Password saat ini wajib diisi.');
      expect(validateCurrentPassword(''), 'Password saat ini wajib diisi.');
      expect(validateCurrentPassword('lama123'), isNull);
    });
  });

  group('validatePasswordConfirmation', () {
    test('empty is required', () {
      expect(
        validatePasswordConfirmation('', 'Abcdefg1'),
        'Ulangi password baru wajib diisi.',
      );
      expect(
        validatePasswordConfirmation(null, 'Abcdefg1'),
        'Ulangi password baru wajib diisi.',
      );
    });

    test('mismatch rejected with existing message', () {
      expect(
        validatePasswordConfirmation('Abcdefg2', 'Abcdefg1'),
        'Password tidak sama',
      );
    });

    test('match passes', () {
      expect(validatePasswordConfirmation('Abcdefg1', 'Abcdefg1'), isNull);
    });
  });
}
