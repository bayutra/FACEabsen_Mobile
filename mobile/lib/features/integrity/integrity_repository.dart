import 'dart:io';

import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';

/// Play Integrity (Android) / App Attest (iOS) token provider.
///
/// Fase go-live: mengembalikan token integrity bila platform API tersedia,
/// atau `null` agar server memakai fallback `deviceCompromised` (mode lax)
/// selama migrasi. Bila `INTEGRITY_STRICT=true` di server, `null` berarti
/// presensi DITOLAK — farm produksi wajib device bersih + Play terdaftar.
///
/// Wiring Play Integrity API (lihat docs/INTEGRITY.md):
/// 1. Aktifkan Play Integrity API di Play Console untuk applicationId.
/// 2. Tambahkan plugin resmi ke pubspec, panggil requestIntegrityToken()
///    di sini dan kembalikan verdict JWT-nya.
/// 3. iOS: ganti dengan App Attest `generateKey` + `attestKey` flow.
class IntegrityRepository {
  /// Token JWT integrity untuk dikirim sebagai `integrityToken`, atau null.
  Future<String?> getToken() async {
    // TODO(go-live): ganti stub ini dengan panggilan Play Integrity /
    // App Attest yang sesungguhnya. Stub mengembalikan null agar tidak
    // memblokir pilot; server strict akan menolak null (by design).
    return null;
  }

  /// Sinyal lokal (offline-capable) — tetap dikirim sebagai
  /// `deviceCompromised` bersama token di atas.
  Future<bool> isCompromised() => FlutterJailbreakDetection.jailbroken;

  String get platform => Platform.isIOS ? 'IOS' : 'ANDROID';
}
