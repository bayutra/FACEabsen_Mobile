import 'dart:async';

import 'package:dio/dio.dart';

/// Short human-readable cause for generic catch-alls (pilot/dev builds).
/// Turns "Periksa koneksi server" dead-ends into actionable info like
/// "(timeout)", "(HTTP 404)", "(Connection refused)".
String describeError(Object e) {
  if (e is TimeoutException) return 'timeout';
  if (e is DioException) {
    final int? code = e.response?.statusCode;
    if (code != null) return 'HTTP $code';
    final String? msg = e.message;
    if (msg != null && msg.isNotEmpty && msg.length <= 120) return msg;
    return e.type.name;
  }
  final String s = e.toString().split('\n').first;
  return s.length <= 120 ? s : '${s.substring(0, 117)}...';
}
