import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import 'punch_models.dart';

class SignatureV1 {
  static String canonicalEmbedding(List<double> values) =>
      values.map((v) => v.toStringAsFixed(6)).join(',');

  static String canonicalLiveness(Map<String, Object?> liveness) {
    final String mode = (liveness['mode'] as String?) ?? 'active';
    final bool passed = liveness['passed'] == true;
    final String completedAt = (liveness['completedAt'] as String?) ?? '';
    final num score = (liveness['score'] as num?) ?? 0;
    final num padScore = (liveness['padScore'] as num?) ?? 0;
    final List<dynamic> challenges =
        (liveness['challenges'] as List<dynamic>?) ?? const <dynamic>[];
    return <String>[
      'mode:$mode',
      'passed:${passed ? 1 : 0}',
      'completedAt:$completedAt',
      'score:${score.toDouble().toStringAsFixed(6)}',
      'padScore:${padScore.toDouble().toStringAsFixed(6)}',
      'challenges:${challenges.join(',')}',
    ].join('|');
  }

  static Future<String> sha256Hex(String value) async {
    final Hash hash = await Sha256().hash(utf8.encode(value));
    return hash.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  static Future<String> message({
    required String action,
    required String deviceId,
    required String requestId,
    required String captureAt,
    String? queuedAt,
    required String nonce,
    required List<double> embedding,
    required Map<String, Object?> liveness,
  }) async {
    final String embHash = await sha256Hex(canonicalEmbedding(embedding));
    final String liveHash = await sha256Hex(canonicalLiveness(liveness));
    return <String>[
      'v1',
      action,
      deviceId,
      requestId,
      captureAt,
      queuedAt ?? '',
      nonce,
      embHash,
      liveHash,
    ].join('|');
  }
}

