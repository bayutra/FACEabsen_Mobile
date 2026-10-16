/// STEP 11 — geo models (pure). Server verdict shapes the UI explanation.
class GeoFix {
  GeoFix({
    required this.latitude,
    required this.longitude,
    required this.accuracyM,
    required this.timestamp,
    required this.isMocked,
  });

  final double latitude;
  final double longitude;
  final double accuracyM;
  final DateTime timestamp;
  final bool isMocked;

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'accuracyM': accuracyM,
        'timestamp': timestamp.toUtc().toIso8601String(),
        'isMocked': isMocked,
      };
}

class GeofenceResult {
  GeofenceResult({
    required this.inside,
    required this.distanceM,
    required this.radiusM,
    required this.mockSuspected,
    required this.coordsValid,
    required this.accuracyOk,
    required this.timestampFresh,
    this.hospitalName,
  });

  final bool inside;
  final double distanceM;
  final double radiusM;
  final bool mockSuspected;
  final bool coordsValid;
  final bool accuracyOk;
  final bool timestampFresh;
  final String? hospitalName;

  factory GeofenceResult.fromJson(Map<String, dynamic> json) {
    final Map checks = (json['checks'] as Map?) ?? {};
    final Map? hospital = json['hospital'] as Map?;
    return GeofenceResult(
      inside: json['inside'] == true,
      distanceM: (json['distanceM'] as num?)?.toDouble() ?? double.nan,
      radiusM: (json['radiusM'] as num?)?.toDouble() ?? 0,
      mockSuspected: json['mockSuspected'] == true,
      coordsValid: checks['coordsValid'] == true,
      accuracyOk: checks['accuracyOk'] == true,
      timestampFresh: checks['timestampFresh'] == true,
      hospitalName: hospital?['name'] as String?,
    );
  }

  /// Indonesian explanation of the FIRST failing check (server order).
  String explanation() {
    if (inside) return 'Di dalam radius rumah sakit.';
    if (mockSuspected) return 'Terdeteksi lokasi palsu (mock). Matikan Fake GPS.';
    if (!coordsValid) return 'Koordinat tidak valid. Tunggu sinyal GPS.';
    if (!timestampFresh) return 'Waktu HP tidak sinkron. Aktifkan waktu otomatis.';
    if (!accuracyOk) return 'Sinyal GPS buruk. Pindah ke area terbuka.';
    return 'Di luar radius (${distanceM.round()} m dari ${radiusM.round()} m).';
  }
}
