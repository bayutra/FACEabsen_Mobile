import 'dart:convert';

import 'package:face_absen_mobile/core/crypto/device_keys.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('generate → 44-char Ed25519 public key', () async {
    final pair = await DeviceKeys.generate();
    final pub = await DeviceKeys.publicKeyBase64(pair);
    expect(pub.length, 44);
    expect(base64Decode(pub).length, 32);
  });

  test('seed export/import roundtrip preserves identity', () async {
    final pair = await DeviceKeys.generate();
    final seed = await DeviceKeys.exportSeedBase64(pair);
    final restored = await DeviceKeys.importFromSeedBase64(seed);
    expect(await DeviceKeys.publicKeyBase64(restored),
        await DeviceKeys.publicKeyBase64(pair));
  });

  test('sign/verify roundtrip; tampered message fails', () async {
    final pair = await DeviceKeys.generate();
    final pub = await pair.extractPublicKey();
    const message = [1, 2, 3, 4, 5];
    final sig = await DeviceKeys.sign(pair, message);
    expect(
        await DeviceKeys.verify(
            publicKey: pub, message: message, signature: sig),
        isTrue);
    expect(
        await DeviceKeys.verify(
            publicKey: pub, message: const [9, 9], signature: sig),
        isFalse);
  });
}
