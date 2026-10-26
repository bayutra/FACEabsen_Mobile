import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'app_version.dart';

class AppUpdateStatus {
  const AppUpdateStatus({
    required this.currentVersion,
    required this.minVersion,
    required this.latestVersion,
    required this.message,
  });

  final String currentVersion;
  final String minVersion;
  final String latestVersion;
  final String message;

  bool get required => isAppVersionBelow(currentVersion, minVersion);
}

class AppConfigRepository {
  AppConfigRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<AppUpdateStatus?> check() async {
    try {
      final PackageInfo pkg = await PackageInfo.fromPlatform();
      final Response<dynamic> res = await _dio.get<dynamic>(
        '/app-config',
        options: Options(
          receiveTimeout: const Duration(seconds: 4),
          sendTimeout: const Duration(seconds: 4),
        ),
      );
      if (res.data is! Map) return null;
      final Map<String, dynamic> body =
          Map<String, dynamic>.from(res.data as Map);
      final String minVersion = body['minVersion']?.toString() ?? '0.0.0';
      return AppUpdateStatus(
        currentVersion: pkg.version,
        minVersion: minVersion,
        latestVersion: body['latestVersion']?.toString() ?? pkg.version,
        message: body['message']?.toString() ??
            'Versi aplikasi Anda sudah tidak didukung. Silakan perbarui aplikasi untuk melanjutkan presensi.',
      );
    } catch (_) {
      return null;
    }
  }
}
