import 'package:dio/dio.dart';

import '../../../core/storage/secure_store.dart';

class TotpChallengeException implements Exception {
  TotpChallengeException({required this.totpToken, required this.expiresIn});

  final String totpToken;
  final int expiresIn;
}

class RegistrationUnit {
  const RegistrationUnit({
    required this.id,
    required this.name,
    required this.hospitalName,
  });

  final String id;
  final String name;
  final String hospitalName;

  String get label => hospitalName.isEmpty ? name : '$name — $hospitalName';

  factory RegistrationUnit.fromJson(Map<String, dynamic> json) {
    return RegistrationUnit(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      hospitalName: (json['hospitalName'] as String?) ?? '',
    );
  }
}

class AuthRepository {
  AuthRepository({required Dio dio, required SecureStore store})
      : _dio = dio,
        _store = store;

  final Dio _dio;
  final SecureStore _store;

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    bool rememberMe = true,
  }) async {
    final Response res = await _dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    final Map<String, dynamic> body =
        Map<String, dynamic>.from(res.data as Map);
    if (body['totpRequired'] == true) {
      throw TotpChallengeException(
        totpToken: body['totpToken'] as String,
        expiresIn: (body['expiresIn'] as num?)?.toInt() ?? 300,
      );
    }
    return _storeSession(body, rememberMe);
  }

  Future<List<RegistrationUnit>> listUnits() async {
    final Response res = await _dio.get('/departments/public');
    final List<dynamic> rows = (res.data as List<dynamic>?) ?? const [];
    return rows
        .map((e) =>
            RegistrationUnit.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
    String? employeeNo,
    String? position,
    String? departmentId,
    bool rememberMe = true,
  }) async {
    final Response res = await _dio.post(
      '/auth/register',
      data: {
        'name': name,
        'email': email,
        'password': password,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (employeeNo != null && employeeNo.isNotEmpty)
          'employeeNo': employeeNo,
        if (position != null && position.isNotEmpty) 'position': position,
        if (departmentId != null && departmentId.isNotEmpty)
          'departmentId': departmentId,
      },
    );
    return _storeSession(
        Map<String, dynamic>.from(res.data as Map), rememberMe);
  }

  Future<Map<String, dynamic>> verifyTotp({
    required String totpToken,
    required String code,
    bool rememberMe = true,
  }) async {
    final Response res = await _dio.post(
      '/auth/totp/verify',
      data: {'totpToken': totpToken, 'code': code},
    );
    return _storeSession(
        Map<String, dynamic>.from(res.data as Map), rememberMe);
  }

  Future<Map<String, dynamic>> recoverTotp({
    required String totpToken,
    required String recoveryCode,
    bool rememberMe = true,
  }) async {
    final Response res = await _dio.post(
      '/auth/totp/recover',
      data: {'totpToken': totpToken, 'recoveryCode': recoveryCode},
    );
    return _storeSession(
        Map<String, dynamic>.from(res.data as Map), rememberMe);
  }

  Future<Map<String, dynamic>> _storeSession(
    Map<String, dynamic> body,
    bool rememberMe,
  ) async {
    final String access = body['accessToken'] as String;
    final String refresh = body['refreshToken'] as String;
    if (rememberMe) {
      await _store.writeTokens(access, refresh);
    } else {
      await _store.writeSessionOnly(access);
    }
    return Map<String, dynamic>.from(body['user'] as Map);
  }

  Future<Map<String, dynamic>?> me() async {
    try {
      final Response res = await _dio.get('/auth/me');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401 || e.response?.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } finally {
      await _store.clearTokens();
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.post(
      '/auth/change-password',
      data: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  }
}
