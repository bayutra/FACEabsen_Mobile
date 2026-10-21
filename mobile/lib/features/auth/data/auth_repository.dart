import 'package:dio/dio.dart';

import '../../../core/storage/secure_store.dart';

/// Thrown by [AuthRepository.login] when the password is correct but the
/// account requires a TOTP second factor. No session exists yet — complete it
/// with [AuthRepository.verifyTotp] or [AuthRepository.recoverTotp].
class TotpChallengeException implements Exception {
  TotpChallengeException({required this.totpToken, required this.expiresIn});

  final String totpToken;
  final int expiresIn;
}

/// Minimal auth calls needed for device binding (PRD STEP 7).
/// Full session UI arrives with attendance history (STEP 14).
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
    final Map<String, dynamic> body = Map<String, dynamic>.from(res.data as Map);
    if (body['totpRequired'] == true) {
      throw TotpChallengeException(
        totpToken: body['totpToken'] as String,
        expiresIn: (body['expiresIn'] as num?)?.toInt() ?? 300,
      );
    }
    return _storeSession(body, rememberMe);
  }

  /// Pendaftaran mandiri: membuat akun login + profil karyawan sekaligus.
  /// Server selalu memberi peran EMPLOYEE; peran administratif hanya dapat
  /// diberikan admin lewat menu Pengguna.
  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    String? phone,
    String? employeeNo,
    String? position,
    bool rememberMe = true,
  }) async {
    final Response res = await _dio.post(
      '/auth/register',
      data: {
        'name': name,
        'email': email,
        'password': password,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (employeeNo != null && employeeNo.isNotEmpty) 'employeeNo': employeeNo,
        if (position != null && position.isNotEmpty) 'position': position,
      },
    );
    return _storeSession(Map<String, dynamic>.from(res.data as Map), rememberMe);
  }

  /// Second-factor login with a 6-digit authenticator code.
  Future<Map<String, dynamic>> verifyTotp({
    required String totpToken,
    required String code,
    bool rememberMe = true,
  }) async {
    final Response res = await _dio.post(
      '/auth/totp/verify',
      data: {'totpToken': totpToken, 'code': code},
    );
    return _storeSession(Map<String, dynamic>.from(res.data as Map), rememberMe);
  }

  /// Second-factor login with a single-use recovery code (consumed server-side).
  Future<Map<String, dynamic>> recoverTotp({
    required String totpToken,
    required String recoveryCode,
    bool rememberMe = true,
  }) async {
    final Response res = await _dio.post(
      '/auth/totp/recover',
      data: {'totpToken': totpToken, 'recoveryCode': recoveryCode},
    );
    return _storeSession(Map<String, dynamic>.from(res.data as Map), rememberMe);
  }

  /// Persists the fresh session. With [rememberMe] the refresh token is
  /// stored as before (survives restarts); without it only the access token
  /// is kept, so the current run keeps working but the next launch finds no
  /// refresh token and [BootstrapGate] routes to login. Logout always clears
  /// both via [logout] regardless of this flag.
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

  /// Revokes the current session and clears local tokens. Re-throwing is
  /// suppressed by callers; local state is always cleared.
  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } finally {
      await _store.clearTokens();
    }
  }

  /// Password change (PRD §35): also kills every other session server-side.
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
