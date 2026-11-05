import 'package:dio/dio.dart';

/// Maps a [DioException] to a user-facing Indonesian message.
///
/// Connectivity failures share one message across screens; each screen
/// supplies its own status-code mapping through [mapStatus].
String dioMessage(
  DioException e, {
  required String Function(int? code) mapStatus,
}) {
  if (e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.connectionError) {
    return 'Server tidak terjangkau. Periksa koneksi jaringan rumah sakit.';
  }
  return mapStatus(e.response?.statusCode);
}

/// Returns the `reason` field of an error response body, when present.
String? dioReason(DioException e) {
  final Object? data = e.response?.data;
  return data is Map ? data['reason'] as String? : null;
}
