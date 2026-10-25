import 'dart:convert';

import '../../../core/storage/secure_store.dart';
import 'punch_models.dart';

class OutboxFullException implements Exception {
  OutboxFullException([this.message = 'Outbox penuh (maks 50)']);
  final String message;
  @override
  String toString() => 'OutboxFullException: $message';
}

class OutboxEntry {
  OutboxEntry({
    required this.kind,
    required this.payload,
    required this.requestId,
    required this.captureAt,
    required this.queuedAt,
    this.attempts = 0,
    this.lastError,
    this.needsAction = false,
  });

  factory OutboxEntry.fromPrepared(PreparedPunch prepared) => OutboxEntry(
        kind: prepared.kind,
        payload: Map<String, Object?>.from(prepared.payload),
        requestId: prepared.requestId,
        captureAt: prepared.captureAt,
        queuedAt: prepared.queuedAt ?? DateTime.now().toUtc(),
        attempts: 0,
        needsAction: false,
      );

  final PunchKind kind;
  final Map<String, Object?> payload;
  final String requestId;
  final DateTime captureAt;
  final DateTime queuedAt;
  int attempts;
  String? lastError;
  bool needsAction;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'kind': kind.name,
        'payload': payload,
        'requestId': requestId,
        'captureAt': captureAt.toUtc().toIso8601String(),
        'queuedAt': queuedAt.toUtc().toIso8601String(),
        'attempts': attempts,
        if (lastError != null) 'lastError': lastError,
        'needsAction': needsAction,
      };

  static OutboxEntry? fromJson(Map<String, dynamic> json) {
    final Object? kindRaw = json['kind'];
    final PunchKind? kind = PunchKind.values
        .cast<PunchKind?>()
        .firstWhere((k) => k?.name == kindRaw, orElse: () => null);
    if (kind == null) return null;
    final Object? payloadRaw = json['payload'];
    final Map<String, Object?> payload = payloadRaw is Map
        ? Map<String, Object?>.from(payloadRaw)
        : <String, Object?>{};
    final String requestId =
        (json['requestId'] as String?) ?? (json['requestId'] as String? ?? '');
    final String? captureRaw = json['captureAt'] as String?;
    DateTime captureAt;
    try {
      captureAt = captureRaw != null
          ? DateTime.parse(captureRaw).toUtc()
          : DateTime.now().toUtc();
    } catch (_) {
      return null;
    }
    final String? queuedRaw = json['queuedAt'] as String?;
    DateTime queuedAt;
    try {
      queuedAt = queuedRaw != null
          ? DateTime.parse(queuedRaw).toUtc()
          : captureAt;
    } catch (_) {
      return null;
    }
    final bool legacy = payload.isEmpty && requestId.isEmpty;
    return OutboxEntry(
      kind: kind,
      payload: payload,
      requestId: requestId.isEmpty ? 'legacy-${captureAt.millisecondsSinceEpoch}' : requestId,
      captureAt: captureAt,
      queuedAt: queuedAt,
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      lastError: json['lastError'] as String?,
      needsAction: legacy ? true : (json['needsAction'] as bool? ?? false),
    )..lastError = legacy ? 'LEGACY_ENTRY' : (json['lastError'] as String?);
  }
}

class OutboxRepository {
  OutboxRepository({required this.store});

  final SecureStore store;
  static const int maxEntries = 50;

  Future<List<OutboxEntry>> load() async {
    final String? raw = await store.readOutbox();
    if (raw == null || raw.isEmpty) return <OutboxEntry>[];
    try {
      final Object? decoded = json.decode(raw);
      if (decoded is! List) return <OutboxEntry>[];
      final List<OutboxEntry> out = <OutboxEntry>[];
      for (final Object? item in decoded) {
        if (item is Map<String, dynamic>) {
          final OutboxEntry? e = OutboxEntry.fromJson(item);
          if (e != null) out.add(e);
        }
      }
      return out;
    } catch (_) {
      return <OutboxEntry>[];
    }
  }

  Future<void> save(OutboxEntry entry) async {
    final List<OutboxEntry> current = await load();
    if (current.length >= maxEntries) {
      throw OutboxFullException();
    }
    current.add(entry);
    await store.writeOutbox(jsonEncode(current.map((e) => e.toJson()).toList()));
  }

  Future<void> replaceAll(List<OutboxEntry> entries) async {
    if (entries.length > maxEntries) throw OutboxFullException();
    await store.writeOutbox(jsonEncode(entries.map((e) => e.toJson()).toList()));
  }

  Future<int> count() async => (await load()).length;

  Future<void> clear() async => store.clearOutbox();
}