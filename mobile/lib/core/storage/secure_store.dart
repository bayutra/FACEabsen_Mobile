import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Typed wrapper over platform secure storage (Keystore/Keychain).
/// Tokens and the device private-key seed live here — never in plain prefs.
///
/// STORAGE_VERSION 2 (2026-10): Android uses EncryptedSharedPreferences
/// (AES-256/GCM via Tink) instead of the legacy AES-CBC default file. The
/// encrypted-prefs file differs from the legacy one, so EXISTING installs
/// lose stored tokens/keys on upgrade: one forced re-login + device
/// re-register. Acceptable pre-go-live; do NOT change these options silently
/// post-launch without a read-old/write-new migration.
class SecureStore {
  SecureStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _accessKey = 'auth_access_token';
  static const _refreshKey = 'auth_refresh_token';
  static const _installKey = 'device_installation_id';
  static const _seedKey = 'device_private_seed';
  static const _deviceIdKey = 'device_id';
  static const _baseUrlKey = 'api_base_url';

  Future<void> writeTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  /// Session-only write for logins with "Ingat Saya" unchecked: the access
  /// token works for this app run, but no refresh token is persisted, so
  /// [BootstrapGate._hasSession] (refresh == null → no session) routes the
  /// next launch back to login. Any stale refresh is deleted defensively.
  Future<void> writeSessionOnly(String access) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.delete(key: _refreshKey);
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<String?> readInstallationId() => _storage.read(key: _installKey);
  Future<void> writeInstallationId(String v) => _storage.write(key: _installKey, value: v);

  Future<String?> readPrivateSeed() => _storage.read(key: _seedKey);
  Future<void> writePrivateSeed(String v) => _storage.write(key: _seedKey, value: v);

  Future<String?> readDeviceId() => _storage.read(key: _deviceIdKey);
  Future<void> writeDeviceId(String v) => _storage.write(key: _deviceIdKey, value: v);

  /// Override alamat backend, diisi dari layar "Server API". `null` berarti
  /// memakai default compile-time (`Env.apiBaseUrl`). Dipakai untuk pengujian
  /// di jaringan berbeda (ngrok/Tailscale) tanpa build ulang.
  Future<String?> readApiBaseUrl() => _storage.read(key: _baseUrlKey);
  Future<void> writeApiBaseUrl(String v) => _storage.write(key: _baseUrlKey, value: v);
  Future<void> clearApiBaseUrl() => _storage.delete(key: _baseUrlKey);

  /// Punch-outbox backlog (JSON list, see `OutboxRepository`). Lives in secure
  /// storage so queued embeddings are encrypted at rest — no new plugin.
  static const outboxKey = 'attendance_outbox_v1';

  Future<String?> readOutbox() => _storage.read(key: outboxKey);
  Future<void> writeOutbox(String v) => _storage.write(key: outboxKey, value: v);
  Future<void> clearOutbox() => _storage.delete(key: outboxKey);

  Future<void> clearDevice() async {
    await _storage.delete(key: _deviceIdKey);
  }
}
