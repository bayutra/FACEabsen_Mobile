import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/network/error_detail.dart';
import '../../../core/widgets/stitch.dart';
import 'attendance_processing_view.dart';
import 'attendance_result_screen.dart';
import 'attendance_screen_widgets.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/data/outbox_repository.dart';
import '../../attendance/data/punch_models.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../face/data/face_repository.dart';
import '../../liveness/presentation/passive_scan_screen.dart';
import '../../device/data/device_repository.dart';
import '../../schedule/data/schedule_repository.dart';
import '../../../core/theme/app_colors.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({
    super.key,
    required this.attendance,
    required this.faces,
    required this.devices,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
    this.shift,
  });

  final AttendanceRepository attendance;
  final FaceRepository faces;
  final DeviceRepository devices;

  final String displayName;
  final String employeeNo;

  final ScheduleEntry? shift;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  String? _phase;
  String? _error;

  String? _queued;
  AttendanceResult? _result;
  bool _busy = false;

  CancelToken? _cancelToken;
  bool _cancelled = false;

  int _step = 0;

  static String _initials(String name) {
    final List<String> parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '—';
    if (parts.length == 1) {
      final String p = parts.first;
      return p.substring(0, p.length >= 2 ? 2 : 1).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  @override
  void dispose() {
    _cancelToken?.cancel();
    super.dispose();
  }

  void _cancelProcessing() {
    _cancelled = true;
    _cancelToken?.cancel();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _phase = null;
      _step = 0;
      _error = 'Presensi dibatalkan oleh pengguna.';
    });
  }

  Future<void> _run(bool checkIn) async {
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
    _cancelled = false;

    final bool nonceReady = await widget.attendance.hasNonceSession();
    if (!mounted || _cancelled) return;
    if (!nonceReady) {
      setState(() {
        _error = 'Sambungkan internet untuk memuat sesi presensi.';
        _busy = false;
        _phase = null;
      });
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _queued = null;
      _result = null;
      _step = 0;
      _phase = 'Verifikasi wajah…';
    });

    List<double>? embedding;
    Map<String, Object>? live;
    String? deviceId;
    bool compromised = false;
    try {
      if (!mounted || _cancelled) return;

      final Map<String, Object>? att =
          await Navigator.of(context).push<Map<String, Object>>(
        MaterialPageRoute(
          builder: (_) => PassiveScanScreen(
              faces: widget.faces, displayName: widget.displayName),
        ),
      );
      if (!mounted || _cancelled) return;
      if (att == null) {
        setState(() {
          _error = 'Verifikasi wajah dibatalkan.';
          _busy = false;
          _phase = null;
        });
        return;
      }
      final List<double> captured = (att['embedding'] as List)
          .cast<num>()
          .map((num e) => e.toDouble())
          .toList();
      embedding = captured;
      live = att;

      setState(() {
        _step = 1;
        _phase = 'Mengirim presensi…';
      });
      final String boundId;
      try {
        boundId = await widget.devices.ensureDeviceId();
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _error = 'Perangkat gagal didaftarkan. Logout lalu login ulang.';
          _busy = false;
          _phase = null;
        });
        return;
      }
      if (!mounted || _cancelled) return;
      deviceId = boundId;
      compromised = await widget.devices.isCompromised();
      if (!mounted || _cancelled) return;
      setState(() {
        _step = 2;
        _phase = 'Memproses presensi…';
      });
      final AttendanceResult result = checkIn
          ? await widget.attendance.checkIn(
              embedding: embedding,
              liveness: live,
              deviceId: deviceId,
              compromised: compromised,
              cancelToken: _cancelToken)
          : await widget.attendance.checkOut(
              embedding: embedding,
              liveness: live,
              deviceId: deviceId,
              compromised: compromised,
              cancelToken: _cancelToken);
      if (!mounted || _cancelled) return;

      FlushResult? flushed;
      try {
        final OutboxRepository box = widget.attendance.outbox();
        if (await box.count() > 0) {
          flushed = await widget.attendance.flushOutbox(outbox: box);
        }
      } catch (_) {}
      if (!mounted || _cancelled) return;
      setState(() {
        _result = result;
        _busy = false;
        _phase = null;
        _step = 3;
        if (flushed != null && flushed.sent > 0) {
          _queued = '${flushed.sent} presensi tertunda berhasil dikirim.';
        }
      });

      if (mounted) {
        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) => AttendanceResultScreen(
              result: result,
              isCheckIn: checkIn,
              displayName: widget.displayName,
              employeeNo: widget.employeeNo,
            ),
          ),
        );
      }
    } on AttendanceOffline catch (e) {
      if (!mounted || _cancelled) return;
      final PreparedPunch? prepared = e.prepared;
      if (prepared == null) {
        setState(() {
          _error = 'Sesi presensi habis; sambungkan internet lalu coba lagi.';
          _busy = false;
          _phase = null;
        });
        return;
      }
      try {
        await widget.attendance
            .outbox()
            .save(OutboxEntry.fromPrepared(prepared));
        setState(() {
          _queued = 'Presensi tersimpan, akan dikirim saat online.';
          _busy = false;
          _phase = null;
        });
      } catch (_) {
        setState(() {
          _error = 'Presensi belum tersimpan. Coba lagi saat online.';
          _busy = false;
          _phase = null;
        });
      }
    } on AttendanceRejected catch (e) {
      if (!mounted || _cancelled) return;
      setState(() {
        _error = e.message;
        _busy = false;
        _phase = null;
      });
    } catch (e) {
      if (!mounted || _cancelled) return;

      if (e is DioException && e.type == DioExceptionType.cancel) return;
      setState(() {
        _error =
            'Presensi gagal. Periksa koneksi server. (${describeError(e)})';
        _busy = false;
        _phase = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) {
      return ProcessingView(
        step: _step,
        phase: _phase,
        onCancel: _cancelProcessing,
      );
    }

    final AttendanceResult? r = _result;
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: AppBar(
        title: const Text('Presensi Kehadiran'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink,
        elevation: 0,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(AppColors.radiusFull),
              border: Border.all(color: AppColors.border),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.apartment, size: 14, color: AppColors.primary),
                SizedBox(width: 4),
                Text(
                  'RSU Darmayu Madiun',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.5)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        _initials(widget.displayName),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.displayName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'NIP: ${widget.employeeNo} • Ruang Rawat Inap Melati',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.inkSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppColors.radiusHero),
                border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primaryFixed),
                    ),
                    child: const Icon(Icons.fingerprint,
                        size: 36, color: AppColors.primary),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Presensi Kehadiran Klinis',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Validasi Wajah, Liveness Biometrik AI, & Hardware UUID',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.inkSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified_user,
                            size: 14, color: AppColors.primaryContainer),
                        SizedBox(width: 6),
                        Text(
                          'Standar Akreditasi KARS & Permenkes RI',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryContainer,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_queued != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: InfoBanner(
                  _queued!,
                  tone: InfoBannerTone.success,
                  title: 'Tersimpan di perangkat',
                ),
              ),
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.errorTint,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: AppColors.error, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: AppColors.errorText,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (widget.shift != null) ...[
              shiftStatusCard(widget.shift!),
              const SizedBox(height: 14),
            ],
            if (r != null) ...[
              AttendanceResultCard(result: r),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(64, 48),
                  side: const BorderSide(color: AppColors.primary),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => setState(() => _result = null),
                icon: const Icon(Icons.refresh, color: AppColors.primary),
                label: const Text(
                  'Presensi Ulang',
                  style: TextStyle(
                      color: AppColors.primary, fontWeight: FontWeight.w600),
                ),
              ),
            ] else ...[
              SizedBox(
                height: 52,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryContainer,
                    foregroundColor: Colors.white,
                    elevation: 2,
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppColors.radiusButton),
                    ),
                  ),
                  onPressed: () => _run(true),
                  icon: const Icon(Icons.login, size: 20),
                  label: const Text(
                    'Absen Masuk (Check-in)',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 52,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.secondary,
                    backgroundColor: Colors.white,
                    side: const BorderSide(
                        color: AppColors.secondary, width: 1.5),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppColors.radiusButton),
                    ),
                  ),
                  onPressed: () => _run(false),
                  icon: const Icon(Icons.logout, size: 20),
                  label: const Text(
                    'Absen Pulang (Check-out)',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
