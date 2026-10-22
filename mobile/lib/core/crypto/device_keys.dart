import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';



class DeviceKeys {
  static final Ed25519 _algo = Ed25519();

  static Future<SimpleKeyPair> generate() => _algo.newKeyPair();

  static Future<String> publicKeyBase64(SimpleKeyPair pair) async {
    final SimplePublicKey pub = await pair.extractPublicKey();
    return base64Encode(pub.bytes);
  }

  static Future<String> exportSeedBase64(SimpleKeyPair pair) async {
    final List<int> seed = await pair.extractPrivateKeyBytes();
    return base64Encode(seed);
  }

  static Future<SimpleKeyPair> importFromSeedBase64(String value) {
    return _algo.newKeyPairFromSeed(base64Decode(value));
  }

  static Future<Uint8List> sign(SimpleKeyPair pair, List<int> message) async {
    final Signature sig = await _algo.sign(message, keyPair: pair);
    return Uint8List.fromList(sig.bytes);
  }

  static Future<bool> verify({
    required SimplePublicKey publicKey,
    required List<int> message,
    required List<int> signature,
  }) async {
    return _algo.verify(
      message,
      signature: Signature(signature, publicKey: publicKey),
    );
  }
}
