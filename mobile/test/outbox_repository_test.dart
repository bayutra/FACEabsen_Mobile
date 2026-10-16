import 'dart:convert';

import 'package:face_absen_mobile/features/attendance/data/outbox_repository.dart';
import 'package:face_absen_mobile/features/location/domain/geo_models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

OutboxEntry _entry({String deviceId = 'd1', PunchKind kind = PunchKind.checkIn}) =>
    OutboxEntry(
      kind: kind,
      fix: GeoFix(
        latitude: -7.95,
        longitude: 112.61,
        accuracyM: 8,
        timestamp: DateTime.parse('2026-10-07T07:00:00.000Z'),
        isMocked: false,
      ),
      embedding: List<double>.filled(192, 0.1),
      liveness: <String, Object>{
        'passed': true,
        'mode': 'passive',
        'completedAt': '2026-10-07T07:00:00.000Z',
        'score': 1.0,
        'padScore': 0.82,
      },
      deviceId: deviceId,
      compromised: false,
      queuedAt: DateTime.parse('2026-10-07T07:05:00.000Z'),
    );

void main() {
  group('outbox round-trip', () {
    test('save lalu load mengembalikan entry yang sama', () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      await box.save(_entry());

      final List<OutboxEntry> loaded = await box.load();
      expect(loaded, hasLength(1));
      final OutboxEntry e = loaded.single;
      expect(e.kind, PunchKind.checkIn);
      expect(e.fix.latitude, -7.95);
      expect(e.fix.longitude, 112.61);
      expect(e.fix.accuracyM, 8);
      expect(e.fix.isMocked, isFalse);
      expect(e.embedding, hasLength(192));
      expect(e.embedding.first, 0.1);
      expect(e.liveness['passed'], isTrue);
      expect(e.liveness['mode'], 'passive');
      expect(e.deviceId, 'd1');
      expect(e.compromised, isFalse);
      expect(e.queuedAt, DateTime.parse('2026-10-07T07:05:00.000Z'));
      expect(await box.count(), 1);
    });

    test('checkOut + integrityToken round-trip', () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      final OutboxEntry src = OutboxEntry(
        kind: PunchKind.checkOut,
        fix: GeoFix(
          latitude: -7.9,
          longitude: 112.6,
          accuracyM: 12,
          timestamp: DateTime.parse('2026-10-07T17:00:00.000Z'),
          isMocked: false,
        ),
        embedding: List<double>.filled(192, 0.2),
        liveness: <String, Object>{
          'passed': true,
          'completedAt': '2026-10-07T17:00:00.000Z',
          'score': 0.9,
        },
        deviceId: 'd9',
        compromised: true,
        integrityToken: 'tok-123',
        queuedAt: DateTime.parse('2026-10-07T17:05:00.000Z'),
      );
      await box.save(src);

      final OutboxEntry e = (await box.load()).single;
      expect(e.kind, PunchKind.checkOut);
      expect(e.compromised, isTrue);
      expect(e.integrityToken, 'tok-123');
    });
  });

  group('cap-10 eviction', () {
    test('entry ke-11 mengusir yang tertua', () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      for (var i = 0; i < 12; i++) {
        await box.save(_entry(deviceId: 'd$i'));
      }

      final List<OutboxEntry> loaded = await box.load();
      expect(loaded, hasLength(OutboxRepository.maxEntries));
      expect(loaded.first.deviceId, 'd2');
      expect(loaded.last.deviceId, 'd11');
    });
  });

  group('corrupt-entry tolerance', () {
    test('entri rusak dibuang, yang valid tetap dimuat, tidak pernah crash',
        () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      final Map<String, dynamic> valid = _entry().toJson();
      await store.writeOutbox(jsonEncode(<Object?>[
        valid,
        42,
        'bukan-map',
        null,
        {'kind': 'checkIn'}, // field tidak lengkap
        {
          ...valid,
          'kind': 'checkSideways', // kind tak dikenal
        },
        {
          ...valid,
          'embedding': ['nan-string'], // embedding korup
        },
        {
          ...valid,
          'queuedAt': 'kemarin-sore', // waktu tak terparse
        },
      ]));

      final List<OutboxEntry> loaded = await box.load();
      expect(loaded, hasLength(1));
      expect(loaded.single.deviceId, 'd1');
      // Self-heal: daftar yang dibersihkan ditulis ulang.
      expect(await box.count(), 1);
    });

    test('payload top-level rusak → antrean kosong, bukan throw', () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      await store.writeOutbox('bukan-json{{{');
      expect(await box.load(), isEmpty);

      await store.writeOutbox(jsonEncode({'bukan': 'list'}));
      expect(await box.load(), isEmpty);

      // Setelah korup, save tetap bisa dipakai lagi.
      await box.save(_entry());
      expect(await box.count(), 1);
    });
  });
}
