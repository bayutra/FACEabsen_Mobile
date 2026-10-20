import 'package:face_absen_mobile/core/config/server_settings.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeBaseUrl', () {
    test('menambahkan https dan /api/v1 saat hanya host yang diisi', () {
      expect(
        normalizeBaseUrl('contoh.ngrok-free.app'),
        'https://contoh.ngrok-free.app/api/v1',
      );
    });

    test('mempertahankan http dan port untuk backend LAN', () {
      expect(
        normalizeBaseUrl('http://192.168.1.10:3000'),
        'http://192.168.1.10:3000/api/v1',
      );
    });

    test('tidak mengubah URL yang sudah lengkap', () {
      expect(
        normalizeBaseUrl('https://api.example.com/api/v1'),
        'https://api.example.com/api/v1',
      );
    });

    test('membuang slash di akhir', () {
      expect(
        normalizeBaseUrl('https://api.example.com/api/v1/'),
        'https://api.example.com/api/v1',
      );
    });

    test('host dengan slash saja dianggap belum punya path API', () {
      expect(
        normalizeBaseUrl('https://api.example.com/'),
        'https://api.example.com/api/v1',
      );
    });

    test('membuang spasi di awal/akhir', () {
      expect(
        normalizeBaseUrl('   https://api.example.com/api/v1   '),
        'https://api.example.com/api/v1',
      );
    });

    test('menolak input kosong', () {
      expect(normalizeBaseUrl(''), isNull);
      expect(normalizeBaseUrl('   '), isNull);
    });

    test('menolak skema selain http/https', () {
      expect(normalizeBaseUrl('ftp://api.example.com'), isNull);
      expect(normalizeBaseUrl('ws://api.example.com'), isNull);
    });

    test('menolak host kosong', () {
      expect(normalizeBaseUrl('https://'), isNull);
    });
  });
}
