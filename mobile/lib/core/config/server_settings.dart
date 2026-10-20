import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../storage/secure_store.dart';
import 'env.dart';

/// Normalisasi input pengguna menjadi base URL yang valid.
///
/// Menerima bentuk yang lazim diketik saat pengujian:
///   `contoh.ngrok-free.app`            -> https://contoh.ngrok-free.app/api/v1
///   `http://192.168.1.10:3000`         -> http://192.168.1.10:3000/api/v1
///   `https://host/api/v1`              -> tetap
/// Mengembalikan `null` bila tidak bisa dijadikan URL http/https.
String? normalizeBaseUrl(String raw) {
  String value = raw.trim();
  if (value.isEmpty) return null;
  if (!value.contains('://')) value = 'https://$value';

  final Uri? uri = Uri.tryParse(value);
  if (uri == null) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;
  if (uri.host.isEmpty) return null;

  // Path kosong berarti pengguna hanya mengetik host: tambahkan prefix API
  // agar tidak perlu mengingat `/api/v1`.
  final String path = (uri.path.isEmpty || uri.path == '/') ? '/api/v1' : uri.path;
  String normalized = uri.replace(path: path, query: null, fragment: null).toString();
  while (normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  return normalized;
}

/// Base URL API yang bisa diubah saat runtime.
///
/// Nilai awal berasal dari `--dart-define=API_BASE_URL=...`. Perubahan dari
/// layar pengaturan disimpan di secure storage sehingga bertahan setelah
/// aplikasi ditutup — berguna saat alamat tunnel (ngrok/Tailscale) berubah
/// tanpa perlu build ulang.
class ServerSettings extends ChangeNotifier {
  ServerSettings({required SecureStore store, required Dio dio})
      : _store = store,
        _dio = dio;

  final SecureStore _store;
  final Dio _dio;

  /// Base URL yang sedang dipakai Dio.
  String get baseUrl => _dio.options.baseUrl;

  /// Nama host saja, untuk ditampilkan ringkas di UI.
  String get hostLabel {
    final Uri? uri = Uri.tryParse(baseUrl);
    return uri?.host.isNotEmpty == true ? uri!.host : baseUrl;
  }

  /// Pakai alamat default compile-time.
  String get defaultBaseUrl => Env.apiBaseUrl;

  /// Muat override tersimpan (bila ada). Dipanggil sekali saat bootstrap,
  /// sebelum request pertama.
  Future<void> restore() async {
    final String? saved = await _store.readApiBaseUrl();
    if (saved == null || saved.isEmpty) return;
    if (normalizeBaseUrl(saved) == null) {
      // Nilai rusak/format lama: jangan bikin aplikasi tidak bisa connect.
      await _store.clearApiBaseUrl();
      return;
    }
    _dio.options.baseUrl = saved;
  }

  /// Simpan + terapkan [raw]. String kosong mengembalikan ke default.
  /// Melempar [FormatException] bila formatnya tidak valid.
  Future<String> apply(String raw) async {
    if (raw.trim().isEmpty) {
      await _store.clearApiBaseUrl();
      _dio.options.baseUrl = Env.apiBaseUrl;
      notifyListeners();
      return Env.apiBaseUrl;
    }

    final String? next = normalizeBaseUrl(raw);
    if (next == null) {
      throw const FormatException('Alamat server tidak valid.');
    }

    await _store.writeApiBaseUrl(next);
    _dio.options.baseUrl = next;
    notifyListeners();
    return next;
  }
}
