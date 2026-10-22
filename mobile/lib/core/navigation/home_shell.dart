import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../validation/password_policy.dart';
import '../../features/admin/domain/admin_access.dart';
import '../../features/admin/presentation/admin_home_screen.dart';
import '../../features/attendance/data/attendance_repository.dart';
import '../../features/attendance/presentation/attendance_screen.dart';
import '../../features/attendance/presentation/history_screen.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/correction/data/correction_repository.dart';
import '../../features/correction/presentation/correction_list_screen.dart';
import '../../features/device/data/device_repository.dart';
import '../../features/device/presentation/device_screen.dart';
import '../../features/face/data/face_repository.dart';
import '../../features/face/presentation/face_registration_screen.dart';
import '../../features/leave/data/leave_repository.dart';
import '../../features/leave/presentation/leave_list_screen.dart';
import '../../features/profile/data/profile_repository.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/home/presentation/home_dashboard.dart';
import '../../features/handovers/presentation/handover_list_screen.dart';
import '../../features/preflight/data/preflight_repository.dart';
import '../../features/preflight/presentation/preflight_screen.dart';
import '../../features/schedule/data/schedule_repository.dart';
import '../../features/schedule/presentation/schedule_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.auth,
    required this.devices,
    required this.faces,
    required this.attendance,
    required this.corrections,
    required this.leaves,
    required this.schedules,
    required this.profiles,
    required this.preflight,
    required this.onLogout,
    required this.dio,
  });

  final Dio dio;

  final AuthRepository auth;
  final DeviceRepository devices;
  final FaceRepository faces;
  final AttendanceRepository attendance;
  final CorrectionRepository corrections;
  final LeaveRepository leaves;
  final ScheduleRepository schedules;
  final ProfileRepository profiles;
  final PreflightRepository preflight;
  final VoidCallback onLogout;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  bool _biometricConsent = true;
  String _displayName = 'Karyawan';
  String _employeeNo = '—';
  List<String> _roles = const <String>[];

  void _go(int i) => setState(() => _index = i);

  Future<void> _showChangePassword() async {
    final TextEditingController current = TextEditingController();
    final TextEditingController next = TextEditingController();
    final TextEditingController confirm = TextEditingController();
    final GlobalKey<FormState> formKey = GlobalKey<FormState>();

    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: const Text('Ganti Password'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: current,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Password saat ini'),
                validator: validateCurrentPassword,
              ),
              TextFormField(
                controller: next,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Password baru',
                  helperText: 'Min. 8 karakter, huruf besar + kecil + angka',
                ),
                validator: validateNewPassword,
              ),
              TextFormField(
                controller: confirm,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Ulangi password baru'),
                validator: (String? v) =>
                    validatePasswordConfirmation(v, next.text),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.of(dialogContext).pop(true);
              }
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );

    if (ok != true) {
      current.dispose();
      next.dispose();
      confirm.dispose();
      return;
    }

    try {
      await widget.auth.changePassword(
        currentPassword: current.text,
        newPassword: next.text,
      );
      if (!mounted) return;
      await _logout();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password berhasil diubah. Silakan masuk kembali.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Gagal mengganti password: ${e is DioException ? (e.response?.statusCode ?? e.message) : e}',
          ),
        ),
      );
    } finally {
      current.dispose();
      next.dispose();
      confirm.dispose();
    }
  }

  Future<void> _logout() async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: const Text('Keluar dari akun?'),
        content: const Text(
          'Sesi di perangkat ini akan dicabut. Masuk kembali kapan saja; '
          'perangkat akan terdaftar otomatis saat Anda masuk.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.auth.logout();
    } catch (_) {}
    if (mounted) widget.onLogout();
  }

  Future<void> _syncConsent() async {
    try {
      final ProfileSnapshot snap = await widget.profiles.load();
      if (mounted) {
        setState(() {
          _displayName = snap.name == '—' ? 'Karyawan' : snap.name;
          _employeeNo = snap.employeeNo;
          _biometricConsent = snap.biometricConsent;
          _roles = snap.roles;
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleBiometric(bool granted) async {
    final bool previous = _biometricConsent;
    setState(() => _biometricConsent = granted);
    try {
      await widget.profiles.setBiometricConsent(granted);
    } catch (_) {
      if (mounted) {
        setState(() => _biometricConsent = previous);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gagal mengubah persetujuan biometrik. Coba lagi.'),
          ),
        );
      }
      rethrow;
    }
  }

  Future<void> _push(Widget page) async {
    await Navigator.of(context)
        .push<void>(MaterialPageRoute(builder: (_) => page));
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    _syncConsent();
  }

  @override
  Widget build(BuildContext context) {
    final Widget profile = ProfileScreen(
      profiles: widget.profiles,
      devices: widget.devices,
      onRegisterFace: () => _push(FaceRegistrationScreen(faces: widget.faces)),
      onLogout: _logout,
      onChangePassword: _showChangePassword,
      onOpenAdmin: canOpenAdminArea(_roles)
          ? () => _push(
                AdminHomeScreen(dio: widget.dio, roles: _roles),
              )
          : null,
    );

    final List<Widget> pages = [
      HomeDashboard(
        attendance: widget.attendance,
        schedules: widget.schedules,
        displayName: _displayName,
        biometricConsent: _biometricConsent,
        onToggleBiometric: _toggleBiometric,
        onStartAttendance: () => _push(_preflight()),
        onOpenCorrections: () => _push(CorrectionListScreen(
          corrections: widget.corrections,
          attendance: widget.attendance,
          displayName: _displayName,
          employeeNo: _employeeNo,
        )),
        onOpenLeaves: () => _push(LeaveListScreen(
          leaves: widget.leaves,
          displayName: _displayName,
          employeeNo: _employeeNo,
        )),
        onOpenSchedule: () => _go(2),
        onOpenProfile: () => _go(4),
        onOpenHistory: () => _go(1),
        onOpenAdmin: canOpenAdminArea(_roles)
            ? () => _push(AdminHomeScreen(dio: widget.dio, roles: _roles))
            : null,
        onOpenHandovers: () => _push(HandoverListScreen(dio: widget.dio)),
      ),
      HistoryScreen(
        attendance: widget.attendance,
        corrections: widget.corrections,
        displayName: _displayName,
        employeeNo: _employeeNo,
      ),
      ScheduleScreen(
        schedules: widget.schedules,
        onRequestLeave: () => _push(LeaveListScreen(
          leaves: widget.leaves,
          displayName: _displayName,
          employeeNo: _employeeNo,
        )),
      ),
      DeviceScreen(
        devices: widget.devices,
        displayName: _displayName,
      ),
      profile,
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        backgroundColor: AppColors.surfaceLowest,
        indicatorColor: AppColors.primaryContainer,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: Colors.white),
            label: 'Beranda',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history, color: Colors.white),
            label: 'Riwayat',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month, color: Colors.white),
            label: 'Jadwal',
          ),
          NavigationDestination(
            icon: Icon(Icons.devices_outlined),
            selectedIcon: Icon(Icons.devices, color: Colors.white),
            label: 'Perangkat',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_circle_outlined),
            selectedIcon: Icon(Icons.account_circle, color: Colors.white),
            label: 'Profil',
          ),
        ],
      ),
    );
  }

  Widget _preflight() => PreflightScreen(
        preflight: widget.preflight,
        onProceed: (PreflightSnapshot snap) => _push(
          AttendanceScreen(
            attendance: widget.attendance,
            faces: widget.faces,
            devices: widget.devices,
            displayName: _displayName,
            employeeNo: _employeeNo,
            shift: snap.shift,
          ),
        ),
      );
}
