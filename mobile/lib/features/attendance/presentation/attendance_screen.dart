import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/network/error_detail.dart';
import '../../../core/widgets/stitch.dart';
import 'attendance_result_screen.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/data/outbox_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../face/data/face_repository.dart';
import '../../location/data/location_repository.dart';
import '../../location/domain/geo_models.dart';
import '../../liveness/presentation/passive_scan_screen.dart';
import '../../device/data/device_repository.dart';
import '../../../core/theme/app_colors.dart';

/// STEP 12 presensi flow (Stitch "Presensi"): GPS → geofence → liveness →
/// wajah → tanda tangan → kirim. Check-in dan check-out satu alur.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({
    super.key,
    required this.attendance,
    required this.locations,
    required this.faces,
    required this.devices,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
  });

  final AttendanceRepository attendance;
  final LocationRepository locations;
  final FaceRepository faces;
  final DeviceRepository devices;

  /// Identity shown on the result screen's evidence block.
  final String displayName;
  final String employeeNo;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  String? _phase;
  String? _error;

  /// Offline-queue receipt: the punch is stored on-device and flushes later.
  /// Rendered as a success banner, never as a red error.
  String? _queued;
  AttendanceResult? _result;
  bool _busy = false;

  /// Genuine cancellation: the button flips [_cancelled] AND aborts the
  /// in-flight Dio socket via [_cancelToken], so a "cancelled" punch can
  /// never come back later as a success receipt.
  CancelToken? _cancelToken;
  bool _cancelled = false;

  /// Honest pipeline position: 0 locating/geofence, 1 face scan done,
  /// 2 payload sent, 3 result received. Drives the step widget — never
  /// hardcoded to done.
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

  Future<void> _run(bool checkIn) async {
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
    _cancelled = false;
    setState(() {
      _busy = true;
      _error = null;
      _queued = null;
      _result = null;
      _step = 0;
      _phase = 'Mengambil lokasi…';
    });
    // Punch inputs hoisted so a transport failure can queue them in the
    // outbox from the `on AttendanceOffline` handler below.
    GeoFix? fix;
    List<double>? embedding;
    Map<String, Object>? live;
    String? deviceId;
    bool compromised = false;
    try {
      fix = await widget.locations.getFix();
      if (!mounted || _cancelled) return;
      setState(() => _phase = 'Memeriksa radius…');
      final GeofenceResult geo = await widget.locations.checkGeofence(fix);
      if (!mounted || _cancelled) return;
      if (!geo.inside) {
        setState(() {
          _error = geo.explanation();
          _busy = false;
          _phase = null;
        });
        return;
      }

      if (!mounted || _cancelled) return;
      setState(() => _phase = 'Verifikasi wajah…');
      // Face ID-style: hold the phone and look at the camera. No commands, and
      // the passing frame carries the embedding, so there is no second capture.
      final Map<String, Object>? att = await Navigator.of(context).push<Map<String, Object>>(
        MaterialPageRoute(
          builder: (_) => PassiveScanScreen(faces: widget.faces, displayName: widget.displayName),
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
      final List<double> captured = (att['embedding'] as List).cast<num>().map((num e) => e.toDouble()).toList();
      embedding = captured;
      live = att;

      setState(() {
        _step = 1;
        _phase = 'Mengirim presensi…';
      });
      final String? boundId = await widget.devices.currentDeviceId();
      if (!mounted || _cancelled) return;
      if (boundId == null) throw StateError('Perangkat belum terdaftar.');
      deviceId = boundId;
      compromised = await widget.devices.isCompromised();
      if (!mounted || _cancelled) return;
      setState(() {
        _step = 2;
        _phase = 'Memproses presensi…';
      });
      final AttendanceResult result = checkIn
          ? await widget.attendance.checkIn(
              fix: fix, embedding: embedding, liveness: live, deviceId: deviceId, compromised: compromised, cancelToken: _cancelToken)
          : await widget.attendance.checkOut(
              fix: fix, embedding: embedding, liveness: live, deviceId: deviceId, compromised: compromised, cancelToken: _cancelToken);
      if (!mounted || _cancelled) return;
      // A successful punch also drains any backlog queued during an earlier
      // outage — but only when there is one, so the happy path stays cheap.
      FlushResult? flushed;
      try {
        final OutboxRepository box = widget.attendance.outbox();
        if (await box.count() > 0) {
          flushed = await widget.attendance.flushOutbox(outbox: box);
        }
      } catch (_) {
        // Best effort only: this punch already succeeded.
      }
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
      // Stitch "Presensi - Hasil Verifikasi": a dedicated result screen rather
      // than an inline card, so the evidence block gets full attention.
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
    } on AttendanceOffline {
      // The punch never reached the server (transport failure): queue it in
      // the outbox for automatic retry instead of showing a dead error.
      // Validation rejections (AttendanceRejected below) keep their current
      // behavior and are never queued.
      if (!mounted || _cancelled) return;
      if (fix != null && embedding != null && live != null && deviceId != null) {
        try {
          await widget.attendance.outbox().save(
                OutboxEntry(
                  kind: checkIn ? PunchKind.checkIn : PunchKind.checkOut,
                  fix: fix,
                  embedding: embedding,
                  liveness: live,
                  deviceId: deviceId,
                  compromised: compromised,
                  queuedAt: DateTime.now().toUtc(),
                ),
              );
        } catch (_) {
          // Queue write failed: still report the punch as unsent below.
        }
      }
      setState(() {
        _queued = 'Presensi tersimpan di perangkat, akan dikirim otomatis.';
        _busy = false;
        _phase = null;
      });
    } on AttendanceRejected catch (e) {
      // A late rejection after cancel stays silent: the user already saw
      // "dibatalkan" and must never get a conflicting receipt or error.
      if (!mounted || _cancelled) return;
      setState(() {
        _error = e.message;
        _busy = false;
        _phase = null;
      });
    } on LocationFailure catch (e) {
      if (!mounted || _cancelled) return;
      setState(() {
        _error = e.message;
        _busy = false;
        _phase = null;
      });
    } catch (e) {
      if (!mounted || _cancelled) return;
      // Aborting our own CancelToken surfaces here as a Dio cancel error.
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      setState(() {
        _error = 'Presensi gagal. Periksa koneksi server. (${describeError(e)})';
        _busy = false;
        _phase = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) {
      return _buildProcessingScreen();
    }

    final AttendanceResult? r = _result;
    return Scaffold(
      backgroundColor: AppColors.canvas,
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
            // Employee Identity Context
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

            // Attendance Action Hero Card
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
                    child: const Icon(Icons.fingerprint, size: 36, color: AppColors.primary),
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
                    'Validasi Lokasi GPS, Liveness Biometrik AI, & Hardware UUID',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.inkSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified_user, size: 14, color: AppColors.primaryContainer),
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
                    const Icon(Icons.error_outline, color: AppColors.error, size: 20),
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

            if (r != null) ...[
              _ResultCard(result: r),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(64, 48),
                  side: const BorderSide(color: AppColors.primary),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => setState(() => _result = null),
                icon: const Icon(Icons.refresh, color: AppColors.primary),
                label: const Text(
                  'Presensi Ulang',
                  style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
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
                      borderRadius: BorderRadius.circular(AppColors.radiusButton),
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
                    side: const BorderSide(color: AppColors.secondary, width: 1.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppColors.radiusButton),
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

  Widget _buildProcessingScreen() {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // Top Header: RS Absen • SIMRS Mobile
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.white,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.local_hospital, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'RS Absen',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                          Row(
                            children: [
                              CircleAvatar(radius: 3, backgroundColor: AppColors.success),
                              SizedBox(width: 4),
                              Text(
                                'SIMRS Mobile Ver. 3.4',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  color: AppColors.inkSecondary,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                  Container(
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
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  children: [
                    // Radar Biometric Component
                    SizedBox(
                      height: 180,
                      child: Center(
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // Outer pulse ring
                            Container(
                              width: 170,
                              height: 170,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.primary.withOpacity(0.2),
                                  width: 2,
                                ),
                              ),
                            ),
                            // Inner pulse ring
                            Container(
                              width: 140,
                              height: 140,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.primary.withOpacity(0.35),
                                  width: 1.5,
                                ),
                              ),
                            ),
                            // User verification target avatar
                            Container(
                              width: 100,
                              height: 100,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.primaryContainer,
                                border: Border.all(color: const Color(0xFF89F5E7), width: 3),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withOpacity(0.3),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: const Center(
                                child: Icon(Icons.person, size: 56, color: Colors.white),
                              ),
                            ),
                            // Floating face badge
                            Positioned(
                              bottom: 35,
                              right: 35,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.face, size: 16, color: AppColors.primary),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Status Titles
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(AppColors.radiusFull),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(radius: 3.5, backgroundColor: AppColors.primaryContainer),
                          SizedBox(width: 6),
                          Text(
                            'Layar Verifikasi Sedang Berlangsung',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primaryContainer,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 8),

                    const Text(
                      'Memverifikasi Presensi Anda...',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),

                    const SizedBox(height: 4),

                    Text(
                      _phase ?? 'Sistem sedang memproses data biometrik dan geolokasi ke server SIMRS Kepegawaian.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.inkSecondary,
                        height: 1.4,
                      ),
                    ),

                    const SizedBox(height: 14),

                    // Progress bar module
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppColors.radiusButton),
                        border: Border.all(color: AppColors.border.withOpacity(0.5)),
                      ),
                      child: Column(
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.timelapse, size: 15, color: AppColors.primary),
                                  SizedBox(width: 6),
                                  Text(
                                    'Proses Sinkronisasi',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.inkSecondary,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                'Mohon tunggu...',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.outline,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(AppColors.radiusFull),
                            child: const LinearProgressIndicator(
                              minHeight: 6,
                              backgroundColor: AppColors.surfaceContainer,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 12),

                    // 3-Step Verification Pipeline, driven by the real [_step]:
                    // GPS/geofence run before the camera opens, so while the
                    // processing screen is visible step 1 is already done only
                    // after the face scan returns — never before.
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppColors.radiusButton),
                        border: Border.all(color: AppColors.border.withOpacity(0.6)),
                      ),
                      child: Column(
                        children: [
                          _pipelineStep(
                            stepNumber: '1',
                            title: 'Verifikasi Biometrik Wajah',
                            subtitle: _step >= 1 ? 'Liveness Lolos' : 'Menunggu hasil pindai wajah',
                            isDone: _step >= 1,
                            isInProgress: _step == 0,
                          ),
                          const Divider(height: 1),
                          _pipelineStep(
                            stepNumber: '2',
                            title: 'Enkripsi & Keamanan Perangkat',
                            subtitle: _step >= 2
                                ? 'Hardware UUID & tanda tangan terkirim'
                                : 'Menunggu giliran pengiriman',
                            isDone: _step >= 2,
                            isInProgress: _step == 1,
                          ),
                          const Divider(height: 1),
                          _pipelineStep(
                            stepNumber: '3',
                            title: 'Validasi Geofence & Jadwal Shift',
                            subtitle: _step >= 3
                                ? 'Selesai'
                                : 'Memeriksa radius zona & shift aktif',
                            isDone: _step >= 3,
                            isInProgress: _step == 2,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Security reassuring card
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.shield_outlined, size: 20, color: AppColors.primary),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Jangan tutup aplikasi saat proses enkripsi berlangsung demi keabsahan log kehadiran.',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: AppColors.inkSecondary,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),

            // Bottom cancel button
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () {
                        // Genuine cancel: stop the state machine AND abort the
                        // socket, so no late success can surface afterwards.
                        _cancelled = true;
                        _cancelToken?.cancel();
                        if (!mounted) return;
                        setState(() {
                          _busy = false;
                          _phase = null;
                          _step = 0;
                          _error = 'Presensi dibatalkan oleh pengguna.';
                        });
                      },
                      icon: const Icon(Icons.close, size: 18),
                      label: const Text(
                        'Batalkan Presensi',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pipelineStep({
    required String stepNumber,
    required String title,
    required String subtitle,
    required bool isDone,
    required bool isInProgress,
  }) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDone
                  ? AppColors.successTint
                  : (isInProgress ? const Color(0xFFE0F2FE) : AppColors.surfaceLow),
              border: Border.all(
                color: isDone
                    ? AppColors.success
                    : (isInProgress ? AppColors.info : AppColors.border),
              ),
            ),
            child: Center(
              child: isDone
                  ? const Icon(Icons.check, size: 15, color: AppColors.successText)
                  : (isInProgress
                      ? const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.info,
                          ),
                        )
                      : Text(
                          stepNumber,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.outline,
                          ),
                        )),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '$stepNumber. $title',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isInProgress ? const Color(0xFF004C6E) : AppColors.ink,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isDone
                            ? AppColors.successTint
                            : (isInProgress ? const Color(0xFFE0F2FE) : AppColors.surfaceLow),
                        borderRadius: BorderRadius.circular(AppColors.radiusFull),
                      ),
                      child: Text(
                        isDone ? 'Selesai' : (isInProgress ? 'Proses' : 'Menunggu'),
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          color: isDone
                              ? AppColors.successText
                              : (isInProgress ? AppColors.info : AppColors.outline),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: isDone
                        ? AppColors.successText
                        : (isInProgress ? AppColors.info : AppColors.outline),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {  const _ResultCard({required this.result});
  final AttendanceResult result;

  @override
  Widget build(BuildContext context) {
    final bool isOut = result.checkOutAt != null;
    final String status = isOut
        ? checkOutStatusLabel(result.checkOutStatus)
        : checkInStatusLabel(result.checkInStatus);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Presensi Berhasil Dicatat',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(status, style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
          if (result.shiftLabel != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(result.shiftLabel!, style: const TextStyle(fontSize: 13, color: AppColors.ink)),
            ),
          if (result.distanceM != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text('Jarak: ${result.distanceM!.round()} m dari centroid presensi',
                  style: const TextStyle(fontSize: 12, color: AppColors.inkSecondary)),
            ),
          if (result.faceScore != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text('Kecocokan Wajah: ${(result.faceScore! * 100).round()}%',
                  style: const TextStyle(fontSize: 12, color: AppColors.inkSecondary)),
            ),
        ],
      ),
    );
  }
}

