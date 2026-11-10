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
  static const _lastScopeKey = 'secure_store_last_scope';
  static const _deviceScopeKey = 'device';

  Future<void> writeTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
    final String? sub = _jwtSubject(access);
    if (sub != null && sub.isNotEmpty) {
      await _storage.write(key: _lastScopeKey, value: sub);
    }
  }

  Future<void> writeSessionOnly(String access) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.delete(key: _refreshKey);
    final String? sub = _jwtSubject(access);
    if (sub != null && sub.isNotEmpty) {
      await _storage.write(key: _lastScopeKey, value: sub);
    }
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  /// Scope akun untuk data yang memang milik user (outbox/nonce). Gunakan sub
  /// token aktif; bila token tidak ada, pakai scope terakhir yang diketahui
  /// agar antrean offline tetap terbaca setelah relogin/refresh sesi.
  Future<String> _accountScope() async {
    final String? sub = _jwtSubject(await readAccessToken());
    if (sub != null && sub.isNotEmpty) {
      await _storage.write(key: _lastScopeKey, value: sub);
      return sub;
    }
    final String? last = await _storage.read(key: _lastScopeKey);
    if (last != null && last.isNotEmpty) return last;
    return 'anon';
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

  Future<String?> _readWithMigration(String baseKey, String scope) async {
    final String scopedKey = '${baseKey}_$scope';
    final String? value = await _storage.read(key: scopedKey);
    if (value != null) return value;
    // Migrasi dari skema lama (per-sub JWT / anon) dan dari kunci tanpa scope.
    for (final String legacy in <String>[
      if (scope != 'anon') '${baseKey}_anon',
      baseKey,
    ]) {
      final String? legacyValue = await _storage.read(key: legacy);
      if (legacyValue != null) {
        await _storage.write(key: scopedKey, value: legacyValue);
        await _storage.delete(key: legacy);
        return legacyValue;
      }
    }
    return null;
  }

  // Identitas perangkat bersifat stabil per instalasi (bukan per JWT sub),
  // agar tidak hilang saat token berganti/kedaluwarsa.
  Future<String?> readInstallationId() async =>
      _readWithMigration(_installKey, _deviceScopeKey);
  Future<void> writeInstallationId(String v) async =>
      _storage.write(key: '${_installKey}_$_deviceScopeKey', value: v);

  Future<String?> readPrivateSeed() async =>
      _readWithMigration(_seedKey, _deviceScopeKey);
  Future<void> writePrivateSeed(String v) async =>
      _storage.write(key: '${_seedKey}_$_deviceScopeKey', value: v);

  Future<String?> readDeviceId() async =>
      _readWithMigration(_deviceIdKey, _deviceScopeKey);
  Future<void> writeDeviceId(String v) async =>
      _storage.write(key: '${_deviceIdKey}_$_deviceScopeKey', value: v);

  Future<String?> readApiBaseUrl() => _storage.read(key: _baseUrlKey);
  Future<void> writeApiBaseUrl(String v) =>
      _storage.write(key: _baseUrlKey, value: v);
  Future<void> clearApiBaseUrl() => _storage.delete(key: _baseUrlKey);

  static const _noncePoolKey = 'attendance_nonce_pool';

  Future<String> _outboxKey() async =>
      'attendance_outbox_v1_${await _accountScope()}';

  Future<String?> readOutbox() async {
    final String scope = await _accountScope();
    return _readWithMigration('attendance_outbox_v1', scope);
  }

  Future<void> writeOutbox(String v) async =>
      _storage.write(key: await _outboxKey(), value: v);

  Future<void> clearOutbox() async => _storage.delete(key: await _outboxKey());

  Future<List<String>?> readNoncePool() async {
    final String scope = await _accountScope();
    final String? raw = await _readWithMigration(_noncePoolKey, scope);
    if (raw == null || raw.isEmpty) return null;
    try {
      final Object? decoded = json.decode(raw);
      if (decoded is List) return decoded.cast<String>();
    } catch (_) {}
    return null;
  }

  Future<void> writeNoncePool(List<String> pool) async => _storage.write(
        key: '${_noncePoolKey}_${await _accountScope()}',
        value: json.encode(pool),
      );

  Future<void> clearNoncePool() async =>
      _storage.delete(key: '${_noncePoolKey}_${await _accountScope()}');

  Future<void> clearDevice() async {
    await _storage.delete(key: '${_deviceIdKey}_$_deviceScopeKey');
  }

  Future<void> clearDeviceIdentity() async {
    await _storage.delete(key: '${_installKey}_$_deviceScopeKey');
    await _storage.delete(key: '${_seedKey}_$_deviceScopeKey');
    await _storage.delete(key: '${_deviceIdKey}_$_deviceScopeKey');
  }

  /// Migrasi eksplisit data storage lama (dipanggil sekali saat start) agar
  /// identitas perangkat & antrean akun tidak hilang setelah perubahan skema
  /// scope. Aman dipanggil berulang (idempoten).
  Future<void> migrateLegacyStorage() async {
    Map<String, String> all;
    try {
      all = await _storage.readAll();
    } catch (_) {
      return;
    }
    if (all.isEmpty) return;

    // Identitas perangkat: stabil per instalasi -> satukan ke scope 'device'.
    for (final String base in <String>[_installKey, _seedKey, _deviceIdKey]) {
      await _migrateToScope(all, base, _deviceScopeKey,
          prefer: const <String>[_deviceScopeKey]);
    }

    // Data akun (outbox/nonce): gunakan scope akun yang diketahui.
    final String accountScope = await _resolveKnownAccountScope(all);
    for (final String base in <String>['attendance_outbox_v1', _noncePoolKey]) {
      await _migrateToScope(all, base, accountScope,
          prefer: <String>[accountScope, 'anon']);
    }

    // Jika token aktif ada, pastikan last-scope tercatat.
    final String? sub = _jwtSubject(await readAccessToken());
    if (sub != null && sub.isNotEmpty) {
      await _storage.write(key: _lastScopeKey, value: sub);
    }
  }

  Future<String> _resolveKnownAccountScope(Map<String, String> all) async {
    final String? sub = _jwtSubject(await readAccessToken());
    if (sub != null && sub.isNotEmpty) return sub;
    final String? last = all[_lastScopeKey];
    if (last != null && last.isNotEmpty) return last;
    // Fallback: bila ada tepat satu scope sub lama untuk outbox, pakai itu
    // agar antrean offline milik akun tersebut tidak terbuang.
    final Set<String> scopes = <String>{};
    for (final String key in all.keys) {
      if (key.startsWith('attendance_outbox_v1_')) {
        scopes.add(key.substring('attendance_outbox_v1_'.length));
      }
    }
    scopes.remove('anon');
    if (scopes.length == 1) return scopes.first;
    return 'anon';
  }

  Future<void> _migrateToScope(
    Map<String, String> all,
    String base,
    String targetScope, {
    List<String> prefer = const <String>[],
  }) async {
    final String targetKey = '${base}_$targetScope';
    String? value = all[targetKey];

    // Kumpulkan kandidat legacy (termasuk key tanpa scope & scope lama).
    final List<String> legacyKeys = <String>[];
    for (final String key in all.keys) {
      if (key == targetKey) continue;
      if (key == base || key.startsWith('${base}_')) {
        legacyKeys.add(key);
      }
    }
    if (legacyKeys.isEmpty && value != null) return;

    if (value == null) {
      value = _pickLegacyValue(all, base, legacyKeys, prefer);
      if (value != null) {
        await _storage.write(key: targetKey, value: value);
      }
    }
    // Hapus semua varian legacy agar tidak menggantung.
    for (final String key in legacyKeys) {
      await _storage.delete(key: key);
    }
  }

  String? _pickLegacyValue(
    Map<String, String> all,
    String base,
    List<String> legacyKeys,
    List<String> prefer,
  ) {
    for (final String scope in prefer) {
      final String key = scope.isEmpty ? base : '${base}_$scope';
      if (all.containsKey(key) && legacyKeys.contains(key)) {
        return all[key];
      }
    }
    // Prioritas umum: anon > unscoped > scope lain (mis. sub-JWT lama).
    final List<String> ordered = <String>[
      ...legacyKeys.where((k) => k == '${base}_anon'),
      ...legacyKeys.where((k) => k == base),
      ...legacyKeys.where((k) => k != '${base}_anon' && k != base),
    ];
    for (final String key in ordered) {
      final String? v = all[key];
      if (v != null && v.isNotEmpty) return v;
    }
    return null;
  }
}
