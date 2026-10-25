import 'dart:convert';

import 'package:face_absen_mobile/features/attendance/data/outbox_repository.dart';
import 'package:face_absen_mobile/features/attendance/data/punch_models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

OutboxEntry _entry(
        {String deviceId = 'd1', PunchKind kind = PunchKind.checkIn}) =>
    OutboxEntry(
      kind: kind,
      payload: <String, Object?>{
        'deviceId': deviceId,
        'faceEmbedding': List<double>.filled(192, 0.1),
        'liveness': <String, Object>{
          'passed': true,
          'mode': 'passive',
          'completedAt': '2026-10-07T07:00:00.000Z',
          'score': 1.0,
          'padScore': 0.82,
        },
        'requestId': 'r-$deviceId',
        'captureAt': '2026-10-07T07:00:00.000Z',
        'queuedAt': '2026-10-07T07:05:00.000Z',
        'challengeNonce': 'nonce-x',
        'signatureVersion': 'v1',
        'signature': 'sig-$deviceId',
        'deviceCompromised': false,
      },
      requestId: 'r-$deviceId',
      captureAt: DateTime.parse('2026-10-07T07:00:00.000Z'),
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
      expect(e.payload['faceEmbedding'], hasLength(192));
      expect((e.payload['faceEmbedding'] as List).first, 0.1);
      expect((e.payload['liveness'] as Map)['passed'], isTrue);
      expect((e.payload['liveness'] as Map)['mode'], 'passive');
      expect(e.payload['deviceId'], 'd1');
      expect(e.payload['deviceCompromised'], isFalse);
      expect(e.queuedAt, DateTime.parse('2026-10-07T07:05:00.000Z'));
      expect(e.requestId, 'r-d1');
      expect(await box.count(), 1);
    });

    test('checkOut + integrityToken round-trip', () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      final OutboxEntry src = OutboxEntry(
        kind: PunchKind.checkOut,
        payload: <String, Object?>{
          'deviceId': 'd9',
          'faceEmbedding': List<double>.filled(192, 0.2),
          'liveness': <String, Object>{
            'passed': true,
            'completedAt': '2026-10-07T17:00:00.000Z',
            'score': 0.9,
          },
          'requestId': 'r-d9',
          'captureAt': '2026-10-07T17:00:00.000Z',
          'queuedAt': '2026-10-07T17:05:00.000Z',
          'challengeNonce': 'nonce-y',
          'signatureVersion': 'v1',
          'signature': 'sig',
          'deviceCompromised': true,
          'integrityToken': 'tok-123',
        },
        requestId: 'r-d9',
        captureAt: DateTime.parse('2026-10-07T17:00:00.000Z'),
        queuedAt: DateTime.parse('2026-10-07T17:05:00.000Z'),
      );
      await box.save(src);

      final OutboxEntry e = (await box.load()).single;
      expect(e.kind, PunchKind.checkOut);
      expect(e.payload['deviceCompromised'], isTrue);
      expect(e.payload['integrityToken'], 'tok-123');
    });
  });

  group('full outbox', () {
    test('entry ke-51 melempar OutboxFullException', () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      for (var i = 0; i < OutboxRepository.maxEntries; i++) {
        await box.save(_entry(deviceId: 'd$i'));
      }
      expect(
        () => box.save(_entry(deviceId: 'd50')),
        throwsA(isA<OutboxFullException>()),
      );
      expect(await box.count(), OutboxRepository.maxEntries);
      expect((await box.load()).first.payload['deviceId'], 'd0');
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
        {'kind': 'checkIn'},
        {
          ...valid,
          'kind': 'checkSideways',
        },
        {
          ...valid,
          'embedding': ['nan-string'],
        },
        {
          ...valid,
          'queuedAt': 'kemarin-sore',
        },
      ]));

      final List<OutboxEntry> loaded = await box.load();
      expect(loaded, hasLength(3));
      expect(loaded.first.payload['deviceId'], 'd1');

      expect(await box.count(), 3);
    });

    test('payload top-level rusak → antrean kosong, bukan throw', () async {
      final FakeStore store = FakeStore();
      final OutboxRepository box = OutboxRepository(store: store);

      await store.writeOutbox('bukan-json{{{');
      expect(await box.load(), isEmpty);

      await store.writeOutbox(jsonEncode({'bukan': 'list'}));
      expect(await box.load(), isEmpty);

      await box.save(_entry());
      expect(await box.count(), 1);
    });
  });
}
