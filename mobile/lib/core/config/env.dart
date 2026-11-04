import 'package:flutter/foundation.dart' show kReleaseMode;

class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );

  /// SHA-256 fingerprint(s) of the TLS leaf certificate, comma separated
  /// (hex; ':' separators are allowed). Build with:
  ///   --dart-define=API_CERT_SHA256=AA:BB:CC:...
  /// Release builds refuse to start without at least one valid pin.
  static const apiCertSha256 = String.fromEnvironment('API_CERT_SHA256');

  /// Build-time escape hatch for demo/sideload builds that must talk to a
  /// plain-http LAN server. Explicitly insecure; never ship a store release
  /// with this flag.
  static const allowInsecureHttp = bool.fromEnvironment('ALLOW_INSECURE_HTTP');

  static const appName = String.fromEnvironment(
    'APP_NAME',
    defaultValue: 'Face Absen',
  );

  /// Release builds must talk HTTPS to a server whose certificate matches a
  /// configured pin. Debug builds may run against localhost over http.
  static void assertSecureConfiguration() {
    if (!kReleaseMode || allowInsecureHttp) return;

    final Uri? uri = Uri.tryParse(apiBaseUrl);
    if (uri == null || uri.scheme != 'https') {
      throw StateError(
        'Build release wajib memakai API_BASE_URL https:// '
        '(saat ini: $apiBaseUrl).',
      );
    }
    if (parsePinnedFingerprints(apiCertSha256).isEmpty) {
      throw StateError(
        'Build release wajib memakai '
        '--dart-define=API_CERT_SHA256=<fingerprint SHA-256 sertifikat>.',
      );
    }
  }
}

/// Normalizes a comma-separated fingerprint list: strips separators, lowercases
/// hex, and drops entries that are not a full SHA-256 (32 bytes = 64 hex chars).
List<String> parsePinnedFingerprints(String raw) {
  final List<String> pins = <String>[];
  for (final String part in raw.split(',')) {
    final String hex =
        part.replaceAll(RegExp(r'[^0-9a-fA-F]'), '').toLowerCase();
    if (hex.length == 64) pins.add(hex);
  }
  return List<String>.unmodifiable(pins);
}
