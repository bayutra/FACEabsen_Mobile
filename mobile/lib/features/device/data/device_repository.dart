import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:uuid/uuid.dart';

import '../../../core/crypto/device_keys.dart';
import '../../../core/storage/secure_store.dart';
import '../domain/device_models.dart';

class DeviceRepository {
  DeviceRepository({required Dio dio, required SecureStore store})
      : _dio = dio,
        _store = store;

  final Dio _dio;
  final SecureStore _store;

  Future<String> installationId() async {
    final String? existing = await _store.readInstallationId();
    if (existing != null && existing.isNotEmpty) return existing;
    final String fresh = const Uuid().v4();
    await _store.writeInstallationId(fresh);
    return fresh;
  }

  Future<String> publicKeyBase64() async {
    final String? seed = await _store.readPrivateSeed();
    if (seed != null && seed.isNotEmpty) {
      final pair = await DeviceKeys.importFromSeedBase64(seed);
      return DeviceKeys.publicKeyBase64(pair);
    }
    final pair = await DeviceKeys.generate();
    await _store.writePrivateSeed(await DeviceKeys.exportSeedBase64(pair));
    return DeviceKeys.publicKeyBase64(pair);
  }

  Future<bool> isCompromised() => FlutterJailbreakDetection.jailbroken;

  Future<BoundDevice> register() async {
    try {
      return await _registerOnce();
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        await _store.clearDeviceIdentity();
        return _registerOnce();
      }
      rethrow;
    }
  }

  Future<BoundDevice> _registerOnce() async {
    final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    String? model;
    if (Platform.isAndroid) {
      final AndroidDeviceInfo a = await deviceInfo.androidInfo;
      model = '${a.manufacturer} ${a.model}'.trim();
    } else if (Platform.isIOS) {
      final IosDeviceInfo i = await deviceInfo.iosInfo;
      model = i.utsname.machine;
    }
    final PackageInfo pkg = await PackageInfo.fromPlatform();

    final String pub = await publicKeyBase64();
    final String? seed = await _store.readPrivateSeed();
    if (seed == null || seed.isEmpty) {
      throw StateError('Device key missing — could not start registration.');
    }
    final pair = await DeviceKeys.importFromSeedBase64(seed);
    final Response challenge = await _dio.get('/devices/register-challenge');
    final String nonce = (challenge.data as Map)['nonce'] as String;
    final signature = await DeviceKeys.sign(pair, utf8.encode(nonce));

    final Response res = await _dio.post(
      '/devices/register',
      data: {
        'installationId': await installationId(),
        'platform': Platform.isIOS ? 'IOS' : 'ANDROID',
        'deviceName': model,
        'appVersion': pkg.version,
        'devicePublicKey': pub,
        'nonce': nonce,
        'nonceSignature': base64Encode(signature),
      },
    );
    final BoundDevice device =
        BoundDevice.fromJson(Map<String, dynamic>.from(res.data as Map));
    await _store.writeDeviceId(device.id);
    return device;
  }

  Future<String> ensureDeviceId() async {
    final String? bound = await _store.readDeviceId();
    if (bound != null && bound.isNotEmpty) return bound;
    final BoundDevice device = await register();
    return device.id;
  }

  Future<List<BoundDevice>> myDevices() async {
    final Response res = await _dio.get('/devices/me');
    final List list = res.data as List;
    return list
        .map((e) => BoundDevice.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<BoundDevice> heartbeat(String deviceId) async {
    final Response res = await _dio.post('/devices/$deviceId/heartbeat');
    return BoundDevice.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<String?> currentDeviceId() => _store.readDeviceId();

  Future<ChangeRequest> requestReplacement({
    required String newDeviceId,
    required String reason,
    String? reasonNote,
    required String password,
  }) async {
    final Response res = await _dio.post(
      '/device-change',
      data: {
        'newDeviceId': newDeviceId,
        'reason': reason,
        if (reasonNote != null && reasonNote.isNotEmpty)
          'reasonNote': reasonNote,
        'password': password,
      },
    );
    return ChangeRequest.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<List<ChangeRequest>> myChangeRequests() async {
    final Response res = await _dio.get('/device-change/me');
    final List list = res.data as List;
    return list
        .map((e) => ChangeRequest.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<void> cancelChangeRequest(String id) async {
    await _dio.post('/device-change/$id/cancel');
  }
}
