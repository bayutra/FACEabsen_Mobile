import 'package:dio/dio.dart';

class ProfileRepository {
  ProfileRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<ProfileSnapshot> load() async {
    final List<Object?> results = await Future.wait([
      _try(() => _dio.get('/auth/me')),
      _try(() => _dio.get('/employees/me')),
      _try(() => _dio.get('/face/status')),
      _try(() => _dio.get('/devices/me')),
      _try(() => _dio.get('/privacy/consents/me')),
    ]);

    final Map<String, dynamic>? me = _map(results[0]);
    final Map<String, dynamic>? employee = _map(results[1]);
    final Map<String, dynamic>? face = _map(results[2]);
    final List<dynamic>? devices = _list(results[3]);
    final List<dynamic>? consents = _list(results[4]);

    if (me == null) {
      throw const ProfileUnavailable();
    }

    final Map<String, dynamic>? department =
        employee?['department'] as Map<String, dynamic>?;
    final List<dynamic> deviceList = devices ?? const [];

    return ProfileSnapshot(
      email: me['email'] as String? ?? '—',
      roles: (me['roles'] as List?)?.cast<String>() ?? const [],
      isActive: me['isActive'] == true,
      name: employee?['name'] as String? ?? '—',
      employeeNo: employee?['employeeNo'] as String? ?? '—',
      phone: employee?['phone'] as String? ?? '',
      position: employee?['position'] as String? ?? '—',
      department: department?['name'] as String? ?? '—',
      faceRegistered: face?['registered'] == true,
      faceVersion: face?['version'] as int?,
      activeDevices:
          deviceList.where((d) => (d as Map)['status'] == 'ACTIVE').length,
      totalDevices: deviceList.length,
      biometricConsent: consents?.any(
            (c) =>
                (c as Map)['purpose'] == 'BIOMETRIC_ATTENDANCE' &&
                c['revokedAt'] == null,
          ) ??
          false,
    );
  }

  Future<Object?> _try(Future<Response> Function() call) async {
    try {
      return await call();
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic>? _map(Object? result) {
    if (result is Response && result.data is Map) {
      return Map<String, dynamic>.from(result.data as Map);
    }
    return null;
  }

  List<dynamic>? _list(Object? result) {
    if (result is Response && result.data is List) {
      return result.data as List<dynamic>;
    }
    return null;
  }

  Future<void> setBiometricConsent(bool granted) async {
    await _dio.post(
      '/privacy/consent',
      data: {'purpose': 'BIOMETRIC_ATTENDANCE', 'granted': granted},
    );
  }

  Future<String> displayName() async {
    final Response res = await _dio.get('/employees/me');
    if (res.data == null) return 'Karyawan';
    final Map<String, dynamic> e = Map<String, dynamic>.from(res.data as Map);
    final String name = e['name'] as String? ?? 'Karyawan';
    final String? position = e['position'] as String?;
    return position == null || position.isEmpty ? name : '$name, $position';
  }

  Future<void> updateProfile({
    required String name,
    required String email,
    String? phone,
  }) async {
    await _dio.patch('/employees/me', data: {
      'name': name,
      'email': email,
      'phone': phone ?? '',
    });
  }
}

class ProfileUnavailable implements Exception {
  const ProfileUnavailable();
  @override
  String toString() => 'Profil tidak dapat dimuat.';
}

class ProfileSnapshot {
  ProfileSnapshot({
    required this.email,
    required this.roles,
    required this.isActive,
    required this.name,
    required this.employeeNo,
    required this.phone,
    required this.position,
    required this.department,
    required this.faceRegistered,
    required this.faceVersion,
    required this.activeDevices,
    required this.totalDevices,
    required this.biometricConsent,
  });

  final String email;
  final List<String> roles;
  final bool isActive;
  final String name;
  final String employeeNo;
  final String phone;
  final String position;
  final String department;
  final bool faceRegistered;
  final int? faceVersion;
  final int activeDevices;
  final int totalDevices;
  final bool biometricConsent;
}
