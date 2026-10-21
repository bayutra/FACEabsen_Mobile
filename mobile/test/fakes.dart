import 'package:dio/dio.dart';
import 'package:face_absen_mobile/core/storage/secure_store.dart';
import 'package:face_absen_mobile/features/auth/data/auth_repository.dart';
import 'package:face_absen_mobile/features/device/data/device_repository.dart';
import 'package:face_absen_mobile/features/device/domain/device_models.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// STEP 23 — hand-rolled test doubles (no plugins, no network).
class FakeFlutterSecureStorage extends FlutterSecureStorage {
  final Map<String, String> box = {};

  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WindowsOptions? wOptions,
    MacOsOptions? mOptions,
    WebOptions? webOptions,
  }) async =>
      box[key];

  @override
  Future<void> write({
    required String key,
    required String? value,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WindowsOptions? wOptions,
    MacOsOptions? mOptions,
    WebOptions? webOptions,
  }) async {
    if (value == null) {
      box.remove(key);
    } else {
      box[key] = value;
    }
  }

  @override
  Future<void> delete({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WindowsOptions? wOptions,
    MacOsOptions? mOptions,
    WebOptions? webOptions,
  }) async {
    box.remove(key);
  }
}

class FakeStore extends SecureStore {
  FakeStore() : super(FakeFlutterSecureStorage());
}

class FakeAuthRepository extends AuthRepository {
  FakeAuthRepository({
    this.failLogin = false,
    this.failConnection = false,
    this.challengeTotp = false,
    this.failTotp = false,
    this.failRegister = false,
  }) : super(dio: Dio(), store: FakeStore());

  final bool failLogin;
  final bool failConnection;
  final bool challengeTotp;
  final bool failTotp;
  final bool failRegister;

  /// Unit yang dikembalikan [listUnits]; kosong untuk mensimulasikan
  /// master data yang belum diisi admin.
  List<RegistrationUnit> units = const <RegistrationUnit>[
    RegistrationUnit(
      id: 'dept-1',
      name: 'Instalasi Rawat Inap',
      hospitalName: 'RSU Darmaga',
    ),
  ];

  /// Unit yang dikirim pada pendaftaran terakhir (null bila tidak dipilih).
  String? lastRegisterUnit;

  /// Last `rememberMe` flag received (across login/TOTP paths).
  bool? lastRememberMe;

  DioException _unauthorized(String path) => DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: 401,
        ),
        type: DioExceptionType.badResponse,
      );

  @override
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    bool rememberMe = true,
  }) async {
    lastRememberMe = rememberMe;
    if (failConnection) {
      throw DioException(
        requestOptions: RequestOptions(path: '/auth/login'),
        type: DioExceptionType.connectionError,
      );
    }
    if (failLogin) {
      throw _unauthorized('/auth/login');
    }
    if (challengeTotp) {
      throw TotpChallengeException(totpToken: 'totp-token-test', expiresIn: 300);
    }
    return {'id': 'u1', 'email': email, 'roles': ['EMPLOYEE']};
  }

  @override
  Future<Map<String, dynamic>> verifyTotp({
    required String totpToken,
    required String code,
    bool rememberMe = true,
  }) async {
    lastRememberMe = rememberMe;
    if (failTotp) throw _unauthorized('/auth/totp/verify');
    return {'id': 'u1', 'email': 'karyawan@rs.test', 'roles': ['EMPLOYEE']};
  }

  @override
  Future<Map<String, dynamic>> recoverTotp({
    required String totpToken,
    required String recoveryCode,
    bool rememberMe = true,
  }) async {
    lastRememberMe = rememberMe;
    if (failTotp) throw _unauthorized('/auth/totp/recover');
    return {'id': 'u1', 'email': 'karyawan@rs.test', 'roles': ['EMPLOYEE']};
  }

  @override
  Future<List<RegistrationUnit>> listUnits() async => units;

  @override
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
    lastRegisterUnit = departmentId;
    if (failRegister) {
      final RequestOptions opts = RequestOptions(path: '/auth/register');
      throw DioException(
        requestOptions: opts,
        response: Response(requestOptions: opts, statusCode: 409),
        type: DioExceptionType.badResponse,
      );
    }
    return {
      'id': 'u2',
      'email': email,
      'name': name,
      'roles': ['EMPLOYEE'],
      'employeeNo': 'EMP-999',
    };
  }

  @override
  Future<void> logout() async {}
}

class FakeDeviceRepository extends DeviceRepository {
  FakeDeviceRepository({this.failRegister = false})
      : super(dio: Dio(), store: FakeStore());

  final bool failRegister;
  int registerCalls = 0;

  @override
  Future<BoundDevice> register() async {
    registerCalls++;
    if (failRegister) {
      final RequestOptions opts = RequestOptions(path: '/devices/register');
      throw DioException(
        requestOptions: opts,
        type: DioExceptionType.connectionError,
      );
    }
    return BoundDevice(
        id: 'd1',
        installationId: 'install-test',
        platform: 'ANDROID',
        status: DeviceStatus.active,
      );
  }

  @override
  Future<List<BoundDevice>> myDevices() async => [];

  @override
  Future<List<ChangeRequest>> myChangeRequests() async => [];

  @override
  Future<bool> isCompromised() async => false;

  @override
  Future<String?> currentDeviceId() async => null;

  @override
  Future<BoundDevice> heartbeat(String deviceId) async => BoundDevice(
        id: deviceId,
        installationId: 'install-test',
        platform: 'ANDROID',
        status: DeviceStatus.active,
      );
}
