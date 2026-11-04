import 'dart:io';

import 'package:cryptography/dart.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart' show kReleaseMode;

import '../config/env.dart';

/// Lowercase hex SHA-256 of the DER-encoded certificate.
String certificateFingerprint(X509Certificate certificate) {
  final hash = const DartSha256().hashSync(certificate.der);
  final StringBuffer out = StringBuffer();
  for (final int byte in hash.bytes) {
    out.write(byte.toRadixString(16).padLeft(2, '0'));
  }
  return out.toString();
}

/// Dio adapter that rejects any TLS handshake whose leaf certificate is not in
/// [Env.apiCertSha256]. Debug builds without pins stay usable; release builds
/// cannot reach this fallback because [Env.assertSecureConfiguration] requires
/// at least one pin.
IOHttpClientAdapter createPinnedHttpClientAdapter({List<String>? pins}) {
  final List<String> expected =
      pins ?? parsePinnedFingerprints(Env.apiCertSha256);

  return IOHttpClientAdapter(
    validateCertificate: (X509Certificate? certificate, String host, int port) {
      if (expected.isEmpty) return Env.allowInsecureHttp || !kReleaseMode;
      if (certificate == null) return false;
      return expected.contains(certificateFingerprint(certificate));
    },
  );
}
