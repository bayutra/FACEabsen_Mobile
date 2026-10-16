import 'package:face_absen_mobile/features/location/domain/geo_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fromJson parses server verdict', () {
    final v = GeofenceResult.fromJson({
      'inside': true,
      'distanceM': 12.3,
      'radiusM': 100,
      'mockSuspected': false,
      'checks': {'coordsValid': true, 'accuracyOk': true, 'timestampFresh': true},
      'hospital': {'name': 'RS Contoh'},
    });
    expect(v.inside, isTrue);
    expect(v.hospitalName, 'RS Contoh');
    expect(v.explanation(), contains('dalam radius'));
  });

  test('explanation follows server check order', () {
    GeofenceResult base(Map<String, dynamic> checks, {bool mock = false, bool inside = false}) =>
        GeofenceResult.fromJson({
          'inside': inside,
          'distanceM': 250,
          'radiusM': 100,
          'mockSuspected': mock,
          'checks': {'coordsValid': true, 'accuracyOk': true, 'timestampFresh': true, ...checks},
        });

    expect(base({}, mock: true).explanation(), contains('palsu'));
    expect(base({'coordsValid': false}).explanation(), contains('tidak valid'));
    expect(base({'timestampFresh': false}).explanation(), contains('sinkron'));
    expect(base({'accuracyOk': false}).explanation(), contains('buruk'));
    expect(base({}).explanation(), contains('luar radius'));
  });

  test('GeoFix serializes with UTC timestamp', () {
    final fix = GeoFix(
      latitude: -7.65,
      longitude: 112.23,
      accuracyM: 8,
      timestamp: DateTime(2026, 10, 5, 7, 0),
      isMocked: false,
    );
    final json = fix.toJson();
    expect(json['latitude'], -7.65);
    expect((json['timestamp'] as String).endsWith('Z'), isTrue);
  });
}
