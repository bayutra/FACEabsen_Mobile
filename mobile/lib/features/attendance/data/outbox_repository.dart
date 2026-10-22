import 'dart:convert';

import '../../../core/storage/secure_store.dart';








enum PunchKind { checkIn, checkOut }

class OutboxEntry {
  OutboxEntry({
    required this.kind,
    required this.embedding,
    required this.liveness,
    required this.deviceId,
    required this.compromised,
    this.integrityToken,
    required this.queuedAt,
  });

  final PunchKind kind;
  final List<double> embedding;
  final Map<String, Object> liveness;
  final String deviceId;
  final bool compromised;
  final String? integrityToken;
  final DateTime queuedAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'kind': kind.name,
        'embedding': embedding,
        'liveness': _jsonSafe(liveness),
        'deviceId': deviceId,
        'compromised': compromised,
        if (integrityToken != null && integrityToken!.isNotEmpty)
          'integrityToken': integrityToken,
        'queuedAt': queuedAt.toUtc().toIso8601String(),
      };

  
  static OutboxEntry? fromJson(Map<String, dynamic> json) {
    try {
      final Object? kindRaw = json['kind'];
      if (kindRaw is! String) return null;
      final PunchKind kind = PunchKind.values.byName(kindRaw);

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
        
        try {
          await replaceAll(entries);
        } catch (_) {
          
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
