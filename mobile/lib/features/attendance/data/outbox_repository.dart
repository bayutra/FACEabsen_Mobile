import 'dart:convert';

import '../../../core/storage/secure_store.dart';
import '../../location/domain/geo_models.dart';

/// Punch-outbox for transient outages (basement Wi-Fi, dead spots).
///
/// Dependency-free: persistence is a JSON list in the existing [SecureStore]
/// (key [SecureStore.outboxKey]), so queued embeddings are encrypted at rest
/// for free. Capped at [OutboxRepository.maxEntries] entries; the oldest is
/// dropped when the cap is exceeded. Corrupt entries are dropped on load and
/// never crash the caller.
enum PunchKind { checkIn, checkOut }

class OutboxEntry {
  OutboxEntry({
    required this.kind,
    required this.fix,
    required this.embedding,
    required this.liveness,
    required this.deviceId,
    required this.compromised,
    this.integrityToken,
    required this.queuedAt,
  });

  final PunchKind kind;
  final GeoFix fix;
  final List<double> embedding;
  final Map<String, Object> liveness;
  final String deviceId;
  final bool compromised;
  final String? integrityToken;
  final DateTime queuedAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'kind': kind.name,
        'fix': fix.toJson(),
        'embedding': embedding,
        'liveness': _jsonSafe(liveness),
        'deviceId': deviceId,
        'compromised': compromised,
        if (integrityToken != null && integrityToken!.isNotEmpty)
          'integrityToken': integrityToken,
        'queuedAt': queuedAt.toUtc().toIso8601String(),
      };

  /// Returns null for corrupt entries — callers drop them, never throw.
  static OutboxEntry? fromJson(Map<String, dynamic> json) {
    try {
      final Object? kindRaw = json['kind'];
      if (kindRaw is! String) return null;
      final PunchKind kind = PunchKind.values.byName(kindRaw);

      final Object? fixRaw = json['fix'];
      if (fixRaw is! Map) return null;
      final Map<String, dynamic> fixJson = Map<String, dynamic>.from(fixRaw);
      final double? lat = (fixJson['latitude'] as num?)?.toDouble();
      final double? lon = (fixJson['longitude'] as num?)?.toDouble();
      final double? acc = (fixJson['accuracyM'] as num?)?.toDouble();
      final DateTime? fixTs = DateTime.tryParse('${fixJson['timestamp']}');
      final Object? mockedRaw = fixJson['isMocked'];
      if (lat == null ||
          lon == null ||
          acc == null ||
          fixTs == null ||
          mockedRaw is! bool ||
          !lat.isFinite ||
          !lon.isFinite) {
        return null;
      }

      final Object? embRaw = json['embedding'];
      if (embRaw is! List || embRaw.isEmpty) return null;
      final List<double> embedding = <double>[];
      for (final Object? e in embRaw) {
        if (e is! num || !e.isFinite) return null;
        embedding.add(e.toDouble());
      }

      final Object? liveRaw = json['liveness'];
      if (liveRaw is! Map) return null;
      final Map<String, Object> liveness =
          Map<String, dynamic>.from(liveRaw).map((k, v) => MapEntry(k, v as Object));
      if (liveness['passed'] is! bool) return null;

      final Object? deviceRaw = json['deviceId'];
      if (deviceRaw is! String || deviceRaw.isEmpty) return null;
      final Object? compRaw = json['compromised'];
      if (compRaw is! bool) return null;
      final Object? tokenRaw = json['integrityToken'];
      if (tokenRaw != null && tokenRaw is! String) return null;
      final DateTime? queuedAt = DateTime.tryParse('${json['queuedAt']}');
      if (queuedAt == null) return null;

      return OutboxEntry(
        kind: kind,
        fix: GeoFix(
          latitude: lat,
          longitude: lon,
          accuracyM: acc,
          timestamp: fixTs,
          isMocked: mockedRaw,
        ),
        embedding: embedding,
        liveness: liveness,
        deviceId: deviceRaw,
        compromised: compRaw,
        integrityToken: tokenRaw as String?,
        queuedAt: queuedAt,
      );
    } catch (_) {
      return null;
    }
  }

  /// Drops values `jsonEncode` cannot represent (DateTime stays a string via
  /// toString; arbitrary objects are stringified rather than lost).
  static Object? _jsonSafe(Object? value) {
    if (value == null || value is String || value is num || value is bool) {
      return value;
    }
    if (value is List) return value.map(_jsonSafe).toList();
    if (value is Map) {
      final Map<String, Object?> out = <String, Object?>{};
      value.forEach((k, v) {
        if (k is String) out[k] = _jsonSafe(v);
      });
      return out;
    }
    return value.toString();
  }
}

class OutboxRepository {
  OutboxRepository({required SecureStore store}) : _store = store;

  final SecureStore _store;

  /// Hard cap: the outbox covers transient blips, not hours-long offline.
  /// When full, the oldest entry is evicted to make room.
  static const int maxEntries = 10;

  Future<List<OutboxEntry>> load() async {
    final String? raw = await _store.readOutbox();
    if (raw == null || raw.isEmpty) return <OutboxEntry>[];
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is! List) return <OutboxEntry>[];
      final List<OutboxEntry> entries = <OutboxEntry>[];
      var dropped = 0;
      for (final Object? e in decoded) {
        if (e is! Map) {
          dropped++;
          continue;
        }
        final OutboxEntry? entry =
            OutboxEntry.fromJson(Map<String, dynamic>.from(e));
        if (entry == null) {
          dropped++;
        } else {
          entries.add(entry);
        }
      }
      if (dropped > 0) {
        // Self-heal: persist the cleaned list so corruption cannot grow.
        try {
          await replaceAll(entries);
        } catch (_) {
          // Best effort only; the in-memory list is still valid.
        }
      }
      return entries;
    } catch (_) {
      return <OutboxEntry>[];
    }
  }

  Future<int> count() async => (await load()).length;

  Future<void> save(OutboxEntry entry) async {
    final List<OutboxEntry> entries = await load();
    entries.add(entry);
    while (entries.length > maxEntries) {
      entries.removeAt(0);
    }
    await replaceAll(entries);
  }

  Future<void> replaceAll(List<OutboxEntry> entries) async {
    final List<OutboxEntry> capped = entries.length <= maxEntries
        ? entries
        : entries.sublist(entries.length - maxEntries);
    await _store.writeOutbox(
      jsonEncode(capped.map((e) => e.toJson()).toList()),
    );
  }

  Future<void> clear() => _store.clearOutbox();
}
