import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'core/config/env.dart';
import 'core/config/server_settings.dart';
import 'core/config/server_settings_dialog.dart';
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

/// Root gate: memeriksa sesi sekali, lalu menampilkan Login atau HomeShell
/// secara deklaratif.
///
/// Sebelumnya gate ini bernavigasi dengan `pushReplacement` dari method milik
/// State-nya sendiri. Begitu route-nya diganti, State tersebut dibuang,
/// sehingga closure `onDone`/`onLogout` yang dipegang LoginScreen/HomeShell
/// memanggil `Navigator` dari context yang sudah mati: login berakhir di
/// "Terjadi kesalahan sistem" dan logout tidak kembali ke menu login.
/// Menukar widget lewat state menghilangkan seluruh kelas bug itu.
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

  /// `null` selama pemeriksaan sesi awal belum selesai.
  bool? _authed;
  Object? _startupError;

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
      detector: FaceDetectorService(
        classification: true,
        contours: true,
        landmarks: true,
      ),
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
    _restore();
  }

  /// Pulihkan alamat server yang pernah diubah pengguna sebelum request
  /// pertama, lalu periksa sesi.
  Future<void> _restore() async {
    setState(() {
      _authed = null;
      _startupError = null;
    });
    try {
      await _servers.restore();
      final bool authed = await _hasSession();
      if (!mounted) return;
      setState(() => _authed = authed);
    } catch (e) {
      if (!mounted) return;
      setState(() => _startupError = e);
    }
  }

  Future<bool> _hasSession() async {
    if (await _store.readRefreshToken() == null) return false;
    return (await _auth.me()) != null;
  }

  Future<void> _openServerSettings() async {
    final bool changed = await showServerSettingsDialog(context, _servers);
    if (changed && mounted) await _restore();
  }

  void _onLoggedIn() => setState(() => _authed = true);

  void _onLoggedOut() => setState(() => _authed = false);

  @override
  Widget build(BuildContext context) {
    if (_startupError != null) {
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
                  onPressed: _restore,
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
    }

    if (_authed == null) {
      return const Scaffold(body: LoadingState(label: 'Menyiapkan sesi'));
    }

    if (_authed!) {
      return HomeShell(
        auth: _auth,
        devices: _devices,
        faces: _faces,
        attendance: _attendance,
        corrections: _corrections,
        leaves: _leaves,
        schedules: _schedules,
        profiles: _profiles,
        preflight: _preflight,
        onLogout: _onLoggedOut,
        dio: _dio,
      );
    }

    return LoginScreen(
      auth: _auth,
      devices: _devices,
      servers: _servers,
      onDone: _onLoggedIn,
    );
  }
}
