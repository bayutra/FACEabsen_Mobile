import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

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

  Future<String> _deviceScope() async {
    final String? sub = _jwtSubject(await readAccessToken());
    return sub ?? 'anon';
  }

  static String? _jwtSubject(String? token) {
    if (token == null || token.isEmpty) return null;
    final List<String> parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      final String payload =
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final Object? decoded = jsonDecode(payload);
      if (decoded is Map && decoded['sub'] is String) {
        final String sub = decoded['sub'] as String;
        return sub.isEmpty ? null : sub;
      }
    } catch (_) {}
    return null;
  }

  Future<String?> readInstallationId() async =>
      _storage.read(key: '${_installKey}_${await _deviceScope()}');
  Future<void> writeInstallationId(String v) async =>
      _storage.write(key: '${_installKey}_${await _deviceScope()}', value: v);

  Future<String?> readPrivateSeed() async =>
      _storage.read(key: '${_seedKey}_${await _deviceScope()}');
  Future<void> writePrivateSeed(String v) async =>
      _storage.write(key: '${_seedKey}_${await _deviceScope()}', value: v);

  Future<String?> readDeviceId() async =>
      _storage.read(key: '${_deviceIdKey}_${await _deviceScope()}');
  Future<void> writeDeviceId(String v) async =>
      _storage.write(key: '${_deviceIdKey}_${await _deviceScope()}', value: v);

  Future<String?> readApiBaseUrl() => _storage.read(key: _baseUrlKey);
  Future<void> writeApiBaseUrl(String v) =>
      _storage.write(key: _baseUrlKey, value: v);
  Future<void> clearApiBaseUrl() => _storage.delete(key: _baseUrlKey);

  static const _noncePoolKey = 'attendance_nonce_pool';

  Future<String> _outboxKey() async => 'attendance_outbox_v1_${await _deviceScope()}';

  Future<String?> readOutbox() async =>
      _storage.read(key: await _outboxKey());

  Future<void> writeOutbox(String v) async =>
      _storage.write(key: await _outboxKey(), value: v);

  Future<void> clearOutbox() async =>
      _storage.delete(key: await _outboxKey());

  Future<List<String>?> readNoncePool() async {
    final String? raw =
        await _storage.read(key: '$_noncePoolKey\_${await _deviceScope()}');
    if (raw == null || raw.isEmpty) return null;
    try {
      final Object? decoded = json.decode(raw);
      if (decoded is List) return decoded.cast<String>();
    } catch (_) {}
    return null;
  }

  Future<void> writeNoncePool(List<String> pool) async =>
      _storage.write(key: '$_noncePoolKey\_${await _deviceScope()}', value: json.encode(pool));

  Future<void> clearNoncePool() async =>
      _storage.delete(key: '$_noncePoolKey\_${await _deviceScope()}');

  Future<void> clearDevice() async {
    await _storage.delete(key: '${_deviceIdKey}_${await _deviceScope()}');
  }

  Future<void> clearDeviceIdentity() async {
    final String scope = await _deviceScope();
    await _storage.delete(key: '${_installKey}_$scope');
    await _storage.delete(key: '${_seedKey}_$scope');
    await _storage.delete(key: '${_deviceIdKey}_$scope');
  }
}
