import 'dart:core';

enum PunchKind { checkIn, checkOut }

class PreparedPunch {
  PreparedPunch({
    required this.kind,
    required this.payload,
    required this.requestId,
    required this.captureAt,
    this.queuedAt,
  });

  final PunchKind kind;
  final Map<String, Object?> payload;
  final String requestId;
  final DateTime captureAt;
  final DateTime? queuedAt;
}

class AttendanceOffline implements Exception {
  AttendanceOffline({this.prepared, this.cause});
  final PreparedPunch? prepared;
  final Object? cause;
  @override
  String toString() => 'AttendanceOffline(prepared: $prepared)';
}