import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';

import '../domain/geo_models.dart';

/// STEP 11 — GPS capture + server geofence verdict (PRD §15-§17).
/// The OS fix is untrusted input; [checkGeofence] asks the server to judge.
class LocationRepository {
  LocationRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  /// Throws [LocationFailure] with an Indonesian message on any problem.
  Future<GeoFix> getFix() async {
    final bool enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) throw LocationFailure('Aktifkan layanan lokasi (GPS) HP.');
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw LocationFailure('Izin lokasi ditolak. Aktifkan di Pengaturan HP.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationFailure('Izin lokasi permanen ditolak. Buka Pengaturan HP.');
    }
    final Position p = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      timeLimit: const Duration(seconds: 15),
    );
    return GeoFix(
      latitude: p.latitude,
      longitude: p.longitude,
      accuracyM: p.accuracy,
      timestamp: p.timestamp,
      isMocked: p.isMocked,
    );
  }

  Future<GeofenceResult> checkGeofence(GeoFix fix) async {
    final Response res = await _dio.post('/geo/check', data: fix.toJson());
    return GeofenceResult.fromJson(Map<String, dynamic>.from(res.data as Map));
  }
}

class LocationFailure implements Exception {
  LocationFailure(this.message);
  final String message;
}
