import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'core/config/env.dart';
import 'core/config/server_settings.dart';
import 'core/config/server_settings_dialog.dart';
import 'core/navigation/startup_state.dart';
import 'core/network/api_client.dart';
import 'core/storage/secure_store.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/stitch.dart';
import 'features/face/data/face_detector.dart';
import 'features/face/data/face_embedder.dart';
import 'features/face/data/face_repository.dart';
import 'features/attendance/data/attendance_repository.dart';
import 'features/correction/data/correction_repository.dart';
import 'features/leave/data/leave_repository.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/device/data/device_repository.dart';
import 'features/profile/data/profile_repository.dart';
import 'features/schedule/data/schedule_repository.dart';
import 'features/preflight/data/preflight_repository.dart';
import 'core/navigation/home_shell.dart';

/// STEP 7 shell: splash → login or device status. Feature routing (face,
/// attendance, history) arrives in later STEPs.
class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: Env.appName,
      theme: buildAppTheme(),
      home: const BootstrapGate(),
    );
  }
}

class BootstrapGate extends StatefulWidget {
  const BootstrapGate({super.key});

  @override
  State<BootstrapGate> createState() => _BootstrapGateState();
}

class _BootstrapGateState extends State<BootstrapGate> {
  late final SecureStore _store;
  late final Dio _dio;
  late final ServerSettings _servers;
  late final AuthRepository _auth;
  late final DeviceRepository _devices;
  late final FaceRepository _faces;
  late final AttendanceRepository _attendance;
  late final CorrectionRepository _corrections;
  late final LeaveRepository _leaves;
  late final ScheduleRepository _schedules;
  late final ProfileRepository _profiles;
  late final PreflightRepository _preflight;
  late Future<bool> _session;

  @override
  void initState() {
    super.initState();
    _store = SecureStore();
    _dio = createApiClient(store: _store);
    _servers = ServerSettings(store: _store, dio: _dio);
    _auth = AuthRepository(dio: _dio, store: _store);
    _devices = DeviceRepository(dio: _dio, store: _store);
    _faces = FaceRepository(
      dio: _dio,
      detector: FaceDetectorService(),
      embedder: FaceEmbedder(),
    );
    _attendance = AttendanceRepository(dio: _dio, store: _store);
    _corrections = CorrectionRepository(dio: _dio);
    _leaves = LeaveRepository(dio: _dio);
    _schedules = ScheduleRepository(dio: _dio);
    _profiles = ProfileRepository(dio: _dio);
    _preflight = PreflightRepository(
      profiles: _profiles,
      schedules: _schedules,
    );
    _session = _bootstrap();
  }

  /// Pulihkan alamat server yang pernah diubah pengguna sebelum request
  /// pertama, lalu periksa sesi.
  Future<bool> _bootstrap() async {
    await _servers.restore();
    return _hasSession();
  }

  Future<bool> _hasSession() async {
    if (await _store.readRefreshToken() == null) return false;
    return (await _auth.me()) != null;
  }

  /// Re-runs the session probe after a startup failure (offline at launch).
  void _retry() {
    setState(() {
      _session = _bootstrap();
    });
  }

  Future<void> _openServerSettings() async {
    final bool changed = await showServerSettingsDialog(context, _servers);
    if (changed && mounted) _retry();
  }

  void _goHome() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => HomeShell(
          auth: _auth,
          devices: _devices,
          faces: _faces,
          attendance: _attendance,
          corrections: _corrections,
          leaves: _leaves,
          schedules: _schedules,
          profiles: _profiles,
          preflight: _preflight,
          onLogout: _goLogin,
        ),
      ),
    );
  }

  void _goLogin() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => LoginScreen(
          auth: _auth,
          devices: _devices,
          servers: _servers,
          onDone: _goHome,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _session,
      builder: (context, snap) {
        final StartupState state = resolveStartupState(snap);
        switch (state) {
          case StartupState.loading:
            return const Scaffold(body: LoadingState(label: 'Menyiapkan sesi'));
          case StartupState.error:
            // Offline (or server down) at launch: _auth.me() rethrows, so
            // without this branch the gate would spin forever. Show an
            // error panel with a retry instead of hanging.
            return Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const InfoBanner(
                        'Periksa koneksi internet, lalu coba lagi. Data '
                        'presensi yang tersimpan di perangkat tetap aman.',
                        tone: InfoBannerTone.error,
                        title: 'Tidak dapat terhubung ke server',
                      ),
                      const SizedBox(height: 12),
                      const Text('RSU Darmayu Madiun'),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _retry,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Coba Lagi'),
                      ),
                      const SizedBox(height: 4),
                      TextButton.icon(
                        onPressed: _openServerSettings,
                        icon: const Icon(Icons.dns_outlined, size: 18),
                        label: Text('Server: ${_servers.hostLabel}'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          case StartupState.authenticated:
          case StartupState.login:
            final bool authed = state == StartupState.authenticated;
            // Defer navigation until after first frame.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              if (authed) {
                _goHome();
              } else {
                _goLogin();
              }
            });
            return const Scaffold(body: LoadingState(label: 'Membuka aplikasi'));
        }
      },
    );
  }
}
