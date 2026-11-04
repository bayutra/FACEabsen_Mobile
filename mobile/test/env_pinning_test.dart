import 'package:face_absen_mobile/core/config/env.dart';
import 'package:face_absen_mobile/core/network/certificate_pinning.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parsePinnedFingerprints', () {
    test('menerima hex 64 karakter dengan atau tanpa pemisah', () {
      final String pin = 'aa' * 32;
      expect(parsePinnedFingerprints(pin), <String>[pin]);
      expect(
        parsePinnedFingerprints(pin.toUpperCase()),
        <String>[pin],
      );
      expect(
        parsePinnedFingerprints('AA:BB:${'0' * 60}'),
        <String>['aabb${'0' * 60}'],
      );
    });

    test('mendukung beberapa fingerprint dipisah koma', () {
      final String a = 'a' * 64;
      final String b = 'b' * 64;
      expect(parsePinnedFingerprints('$a, $b'), <String>[a, b]);
    });

    test('mengabaikan nilai yang bukan SHA-256 penuh', () {
      expect(parsePinnedFingerprints(''), isEmpty);
      expect(parsePinnedFingerprints('   '), isEmpty);
      expect(parsePinnedFingerprints('abcd'), isEmpty);
      expect(parsePinnedFingerprints('${'a' * 63},${'b' * 64}'),
          <String>['b' * 64]);
    });
  });

  group('createPinnedHttpClientAdapter', () {
    test('menolak koneksi tanpa sertifikat saat pin diisi', () {
      final adapter = createPinnedHttpClientAdapter(pins: <String>['a' * 64]);
      expect(adapter.validateCertificate, isNotNull);
      expect(
        adapter.validateCertificate!(null, 'api.example.com', 443),
        isFalse,
      );
    });

    test('tanpa pin, build debug tetap bisa dipakai (release gagal di assert)',
        () {
      final adapter = createPinnedHttpClientAdapter(pins: <String>[]);
      expect(
        adapter.validateCertificate!(null, 'localhost', 3000),
        isTrue,
      );
    });
  });
}
