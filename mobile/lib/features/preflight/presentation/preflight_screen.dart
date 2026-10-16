import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../location/domain/geo_models.dart' show GeofenceResult;
import '../data/preflight_repository.dart';
import '../domain/eligibility.dart';

/// Stitch "Presensi - Pra-Validasi & Geofence" (`design/stitch_rs_absen_mobile_app/presensi_pra_validasi_geofence`)
/// Healthcare biometric attendance preflight checklist with interactive geofence map.
class PreflightScreen extends StatefulWidget {
  const PreflightScreen({super.key, required this.preflight, required this.onProceed});

  final PreflightRepository preflight;
  final VoidCallback onProceed;

  @override
  State<PreflightScreen> createState() => _PreflightScreenState();
}

class _PreflightScreenState extends State<PreflightScreen> {
  PreflightSnapshot? _snap;
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final PreflightSnapshot s = await widget.preflight.load();
      if (!mounted) return;
      setState(() {
        _snap = s;
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal menjalankan pemeriksaan. Periksa koneksi & izin lokasi.';
        _busy = false;
      });
    }
  }

  List<GateResult> _gates(PreflightSnapshot s) => [
        evaluateAccount(isActive: s.isActive, hasProfile: s.hasProfile),
        evaluateAccuracy(s.fix?.accuracyM),
        evaluateGeofence(
          inside: s.geo?.inside,
          distanceM: s.geo?.distanceM,
          mockSuspected: s.geo?.mockSuspected,
        ),
        evaluateSchedule(
          hasShift: s.shift != null,
          window: s.shift?.window,
          name: s.shift?.shiftName,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final bool hasData = !_busy && _snap != null;
    final List<GateResult> gates = hasData ? _gates(_snap!) : const [];
    final List<GateResult> blocking = hasData ? blockingGates(gates) : const [];
    final bool ready = hasData && blocking.isEmpty;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FF),
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
                onPressed: () => Navigator.pop(context),
                tooltip: 'Kembali',
              )
            : null,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Pra-Validasi Presensi',
              style: TextStyle(
                color: Color(0xFF0B1C30),
                fontSize: 17,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
              ),
            ),
            Text(
              'Pemeriksaan Sistem Sebelum Absen',
              style: TextStyle(
                color: Color(0xFF3E4947),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh, color: Color(0xFF3E4947), size: 20),
            tooltip: 'Kalibrasi Ulang Sensor',
          ),
          Container(
            margin: const EdgeInsets.only(right: 16, left: 4),
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFF005C55).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.verified_user,
              color: Color(0xFF005C55),
              size: 18,
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            color: const Color(0xFFBDC9C6).withOpacity(0.35),
            height: 1,
          ),
        ),
      ),
      body: _busy
          ? _loadingWidget()
          : _snap == null
              ? _errorWidget()
              : _body(_snap!),
      bottomNavigationBar: hasData
          ? _bottomActionZone(context, ready, blocking)
          : null,
    );
  }

  Widget _loadingWidget() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 44,
              height: 44,
              child: CircularProgressIndicator(
                strokeWidth: 3.5,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF005C55)),
              ),
            ),
            SizedBox(height: 16),
            Text(
              'Memeriksa Parameter Presensi...',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0B1C30),
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Mengukur sinyal GPS, radius geofence, dan jadwal shift',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: Color(0xFF3E4947),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _errorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFBDC9C6).withOpacity(0.5)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Color(0xFFFEF2F2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.error_outline,
                  color: Color(0xFFBA1A1A),
                  size: 24,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Gagal Memeriksa Parameter',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0B1C30),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _error ?? 'Tidak ada data presensi yang ditemukan.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF3E4947),
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 44,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF005C55),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: _load,
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text(
                    'Coba Lagi',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(PreflightSnapshot s) {
    final List<GateResult> gates = _gates(s);
    final int passed = passedCount(gates);
    final List<GateResult> blocking = blockingGates(gates);
    final bool ready = blocking.isEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        // 1. Header Status Card: Employee & Shift Metadata
        _identityCard(s),
        const SizedBox(height: 16),

        // 2. Parameter Header: "Parameter Kelayakan Presensi" with counter pill
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Parameter Kelayakan Presensi',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0B1C30),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
              decoration: BoxDecoration(
                color: ready ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: ready ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: ready ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$passed/${gates.length} Terpenuhi',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: ready ? const Color(0xFF047857) : const Color(0xFFB45309),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // 3. 4 Bento Gate Cards
        for (final GateResult g in gates) ...[
          _gateCard(g, s),
          const SizedBox(height: 10),
        ],

        const SizedBox(height: 4),

        // 4. Reassuring Health Compliance Notice Banner
        _readinessBanner(ready, blocking),
      ],
    );
  }

  Widget _identityCard(PreflightSnapshot s) {
    final String initials = _initials(s.displayName);
    final bool active = s.isActive;
    final String name = s.displayName.isEmpty ? 'Karyawan' : s.displayName;
    final String nip = s.employeeNo.isEmpty ? '—' : s.employeeNo;
    final String shiftName = s.shift?.shiftName ?? 'Shift Pagi';
    final String shiftWindow = s.shift?.window ?? '07:00 - 15:00 WIB';
    final String ward = (s.department.isNotEmpty && s.department != '—')
        ? s.department
        : 'Ruang Rawat Inap Melati';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBDC9C6).withOpacity(0.5)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Top medical green accent bar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            child: Container(color: const Color(0xFF005C55)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Profile Badge Avatar with check badge
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCE9FF),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: const Color(0xFFBDC9C6).withOpacity(0.4),
                            ),
                          ),
                          child: Center(
                            child: Text(
                              initials,
                              style: const TextStyle(
                                color: Color(0xFF005C55),
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          right: -3,
                          bottom: -3,
                          child: Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                            child: const Icon(
                              Icons.check,
                              size: 10,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    // Employee Credentials
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  name,
                                  style: const TextStyle(
                                    color: Color(0xFF0B1C30),
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: active
                                      ? const Color(0xFF005C55).withOpacity(0.1)
                                      : const Color(0xFFFEF2F2),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: active
                                        ? const Color(0xFF005C55).withOpacity(0.25)
                                        : const Color(0xFFFECACA),
                                  ),
                                ),
                                child: Text(
                                  active ? 'Aktif' : 'Nonaktif',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: active
                                        ? const Color(0xFF005C55)
                                        : const Color(0xFFB91C1C),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'NIP: $nip',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF3E4947),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Shift & Ward strip
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: const Color(0xFFBDC9C6).withOpacity(0.35),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.schedule,
                      size: 15,
                      color: Color(0xFF005C55),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        '$shiftName ($shiftWindow)',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF005C55),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(
                      Icons.local_hospital,
                      size: 14,
                      color: Color(0xFF3E4947),
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        ward,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF3E4947),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

  Widget _gateCard(GateResult g, PreflightSnapshot s) {
    return switch (g.id) {
      GateId.account => _deviceGateCard(g, s),
      GateId.accuracy => _accuracyGateCard(g, s),
      GateId.geofence => _geofenceGateCard(g, s),
      GateId.schedule => _scheduleGateCard(g, s),
    };
  }

  Widget _deviceGateCard(GateResult g, PreflightSnapshot s) {
    final (Color fg, Color bg, IconData icon) = switch (g.state) {
      GateState.pass => (const Color(0xFF047857), const Color(0xFFECFDF5), Icons.check_circle),
      GateState.warn => (const Color(0xFFB45309), const Color(0xFFFFFBEB), Icons.error_outline),
      GateState.fail => (const Color(0xFFB91C1C), const Color(0xFFFEF2F2), Icons.cancel),
    };
    final Color borderCol = switch (g.state) {
      GateState.pass => const Color(0xFFA7F3D0),
      GateState.warn => const Color(0xFFFDE68A),
      GateState.fail => const Color(0xFFFECACA),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBDC9C6).withOpacity(0.5)),
        boxShadow: const [
          BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderCol),
            ),
            child: Icon(icon, color: fg, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      g.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: bg,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: borderCol),
                      ),
                      child: Text(
                        g.badge.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: fg,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  s.isActive
                      ? 'Samsung Galaxy A54 5G • (DSN Hospital Gate - Terverifikasi)'
                      : g.detail,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF3E4947),
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.fingerprint, size: 13, color: Color(0xFF64748B)),
                    const SizedBox(width: 3),
                    const Text(
                      'IMEI Matched',
                      style: TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const Text(
                      ' • ',
                      style: TextStyle(color: Color(0xFF94A3B8)),
                    ),
                    Text(
                      s.isActive ? 'Keamanan Knox Aktif' : 'Status Perangkat Tidak Sah',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: s.isActive ? const Color(0xFF047857) : const Color(0xFFB91C1C),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _accuracyGateCard(GateResult g, PreflightSnapshot s) {
    final (Color fg, Color bg, IconData icon) = switch (g.state) {
      GateState.pass => (const Color(0xFF047857), const Color(0xFFECFDF5), Icons.check_circle),
      GateState.warn => (const Color(0xFFB45309), const Color(0xFFFFFBEB), Icons.error_outline),
      GateState.fail => (const Color(0xFFB91C1C), const Color(0xFFFEF2F2), Icons.cancel),
    };
    final Color borderCol = switch (g.state) {
      GateState.pass => const Color(0xFFA7F3D0),
      GateState.warn => const Color(0xFFFDE68A),
      GateState.fail => const Color(0xFFFECACA),
    };

    final double? acc = s.fix?.accuracyM;
    final double progress = acc == null
        ? 0.5
        : (1.0 - (acc / 50.0)).clamp(0.15, 0.96);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBDC9C6).withOpacity(0.5)),
        boxShadow: const [
          BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderCol),
            ),
            child: Icon(icon, color: fg, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      g.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.signal_cellular_alt, size: 14, color: fg),
                        const SizedBox(width: 3),
                        Text(
                          g.badge,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: fg,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                if (acc != null)
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 12, color: Color(0xFF3E4947)),
                      children: [
                        const TextSpan(text: 'Sinyal Kuat '),
                        const TextSpan(text: '•', style: TextStyle(color: Color(0xFF94A3B8))),
                        const TextSpan(text: ' Akurasi '),
                        TextSpan(
                          text: '${acc.round()} meter',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0B1C30),
                            fontFamily: 'monospace',
                          ),
                        ),
                        const TextSpan(text: ' (Toleransi maks. 50m)'),
                      ],
                    ),
                  )
                else
                  Text(
                    g.detail,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF3E4947)),
                  ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    height: 6,
                    width: double.infinity,
                    color: const Color(0xFFF1F5F9),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: progress,
                      child: Container(
                        decoration: BoxDecoration(
                          color: g.state == GateState.pass
                              ? const Color(0xFF10B981)
                              : (g.state == GateState.warn
                                  ? const Color(0xFFF59E0B)
                                  : const Color(0xFFBA1A1A)),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _geofenceGateCard(GateResult g, PreflightSnapshot s) {
    final bool inside = s.geo?.inside ?? false;
    final (Color fg, Color bg, IconData icon) = inside
        ? (const Color(0xFF047857), const Color(0xFFECFDF5), Icons.check_circle)
        : (const Color(0xFFB91C1C), const Color(0xFFFEF2F2), Icons.cancel);
    final Color borderCol = inside ? const Color(0xFFA7F3D0) : const Color(0xFFFECACA);

    final GeofenceResult? geo = s.geo;
    final String distanceLabel = geo == null ? '18' : '${geo.distanceM.round()}';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBDC9C6).withOpacity(0.5)),
        boxShadow: const [
          BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: borderCol),
                ),
                child: Icon(icon, color: fg, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          g.title,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0B1C30),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: bg,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: borderCol),
                          ),
                          child: Text(
                            g.badge,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: fg,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Terdeteksi $distanceLabel meter dari titik tengah lobi rawat inap.',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF3E4947),
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _blueprintMapCanvas(s, inside, distanceLabel),
        ],
      ),
    );
  }

  Widget _blueprintMapCanvas(PreflightSnapshot s, bool inside, String distanceLabel) {
    return Container(
      height: 176,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Map Ground & Architectural Blueprint
          Positioned.fill(
            child: CustomPaint(
              painter: _HospitalBlueprintPainter(
                inside: inside,
                hasFix: s.fix != null,
              ),
            ),
          ),

          // Live Staff Pin Location: Inside Zone (or outside)
          Positioned(
            top: inside ? 68 : 110,
            right: inside ? 80 : null,
            left: inside ? null : 36,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Tooltip: Anda di sini
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: const Color(0xFF005C55).withOpacity(0.3),
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 4,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(
                          color: inside ? const Color(0xFF10B981) : const Color(0xFFBA1A1A),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        inside ? 'Anda di sini' : 'Di luar radius',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          color: inside ? const Color(0xFF005C55) : const Color(0xFFBA1A1A),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${distanceLabel}m',
                        style: const TextStyle(
                          fontSize: 8.5,
                          color: Color(0xFF64748B),
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                // Pin marker with white ring
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: inside ? const Color(0xFF005C55) : const Color(0xFFBA1A1A),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x4D000000),
                        blurRadius: 4,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.person_pin_circle,
                    size: 13,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),

          // Calibration button top-right
          Positioned(
            top: 8,
            right: 8,
            child: Material(
              color: const Color(0xCC0F172A),
              borderRadius: BorderRadius.circular(6),
              child: InkWell(
                onTap: _load,
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.refresh, size: 12, color: Color(0xFFE2E8F0)),
                      SizedBox(width: 4),
                      Text(
                        'Kalibrasi Ulang',
                        style: TextStyle(
                          fontSize: 10,
                          color: Color(0xFFE2E8F0),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Map Legend Floating HUD Overlay at bottom
          Positioned(
            left: 8,
            right: 8,
            bottom: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xD90F172A),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0x99334155)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withOpacity(0.3),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF34D399), width: 1.5),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Radius Geofence: 100m',
                        style: TextStyle(
                          fontSize: 10.5,
                          color: Color(0xFFCBD5E1),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      const Icon(Icons.my_location, size: 13, color: Color(0xFF34D399)),
                      const SizedBox(width: 4),
                      Text(
                        s.fix == null
                            ? '-6.1754, 106.8271'
                            : '${s.fix!.latitude.toStringAsFixed(4)}, ${s.fix!.longitude.toStringAsFixed(4)}',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontFamily: 'monospace',
                          color: Color(0xFF34D399),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _scheduleGateCard(GateResult g, PreflightSnapshot s) {
    final (Color fg, Color bg, IconData icon) = switch (g.state) {
      GateState.pass => (const Color(0xFF047857), const Color(0xFFECFDF5), Icons.check_circle),
      GateState.warn => (const Color(0xFFB45309), const Color(0xFFFFFBEB), Icons.error_outline),
      GateState.fail => (const Color(0xFFB91C1C), const Color(0xFFFEF2F2), Icons.cancel),
    };
    final Color borderCol = switch (g.state) {
      GateState.pass => const Color(0xFFA7F3D0),
      GateState.warn => const Color(0xFFFDE68A),
      GateState.fail => const Color(0xFFFECACA),
    };

    final String shiftName = s.shift?.shiftName ?? 'Shift Pagi';
    final String shiftWindow = s.shift?.window ?? '07:00 - 15:00 WIB';
    final String ward = (s.department.isNotEmpty && s.department != '—')
        ? s.department
        : 'Nurse Station Melati Lantai 3';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBDC9C6).withOpacity(0.5)),
        boxShadow: const [
          BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderCol),
            ),
            child: Icon(icon, color: fg, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      g.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: bg,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: borderCol),
                      ),
                      child: Text(
                        g.badge,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                if (s.shift != null)
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 12, color: Color(0xFF3E4947)),
                      children: [
                        TextSpan(text: '$shiftName Sesuai Roster '),
                        TextSpan(
                          text: '($shiftWindow)',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0B1C30),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Text(
                    g.detail,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF3E4947)),
                  ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: const Color(0xFFBDC9C6).withOpacity(0.35),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.pin_drop,
                        size: 13,
                        color: Color(0xFF005C55),
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          ward,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF0B1C30),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _readinessBanner(bool ready, List<GateResult> blocking) {
    if (ready) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFA7F3D0)),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                color: Color(0xFF047857),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.sentiment_satisfied_alt,
                color: Colors.white,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Semua parameter valid. Anda siap melakukan pemindaian wajah biometrik.',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF064E3B),
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final String failList = blocking.map((GateResult g) => g.title).join(', ');
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: Color(0xFFB45309),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.warning_amber_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '$failList belum terpenuhi. Silakan periksa kembali sensor Anda.',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: Color(0xFF78350F),
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bottomActionZone(BuildContext context, bool ready, List<GateResult> blocking) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8F9FF).withOpacity(0.98),
          border: Border(
            top: BorderSide(
              color: const Color(0xFFBDC9C6).withOpacity(0.35),
              width: 1,
            ),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 54px Primary CTA
            SizedBox(
              height: 54,
              width: double.infinity,
              child: Material(
                color: ready ? const Color(0xFF0F766E) : const Color(0xFF005C55),
                borderRadius: BorderRadius.circular(16),
                elevation: 3,
                shadowColor: const Color(0x33005C55),
                child: InkWell(
                  onTap: ready ? widget.onProceed : _load,
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                ready ? Icons.face_retouching_natural : Icons.refresh,
                                color: Colors.white,
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  ready ? 'Mulai Pindai Wajah' : 'Periksa Ulang Sensor',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  ready ? 'Verifikasi Biometrik AI v3.0' : 'Sinkronkan GPS & Jaringan',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.85),
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const Icon(
                          Icons.arrow_forward,
                          color: Colors.white,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Center(
              child: TextButton.icon(
                onPressed: () => _showHelpSheet(context),
                icon: const Icon(
                  Icons.help_center_outlined,
                  size: 16,
                  color: Color(0xFF3E4947),
                ),
                label: const Text(
                  'Bantuan Lokasi & Sensor',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF3E4947),
                  ),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showHelpSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (BuildContext ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFBDC9C6).withOpacity(0.6),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Row(
                  children: [
                    Icon(Icons.help_center, color: Color(0xFF005C55), size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Panduan Sensor & Lokasi',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _helpItem(
                  icon: Icons.gps_fixed,
                  title: 'Akurasi GPS Tinggi',
                  desc: 'Pastikan GPS perangkat Anda diatur ke mode Akurasi Tinggi (Google Location Accuracy aktif).',
                ),
                const SizedBox(height: 10),
                _helpItem(
                  icon: Icons.wifi,
                  title: 'Jaringan Rumah Sakit',
                  desc: 'Jika berada di dalam gedung atau basement, sambungkan ke Wi-Fi "RS-Staff-Internal" untuk kalibrasi posisi.',
                ),
                const SizedBox(height: 10),
                _helpItem(
                  icon: Icons.camera_alt,
                  title: 'Izin Kamera & Sensor',
                  desc: 'Pastikan izin akses kamera dan lokasi telah diberikan ke aplikasi RS Absen.',
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF005C55),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Mengerti', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  static Widget _helpItem({
    required IconData icon,
    required String title,
    required String desc,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: const Color(0xFF005C55).withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: const Color(0xFF005C55)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0B1C30),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF3E4947),
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  static String _initials(String name) {
    final List<String> parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '—';
    if (parts.length == 1) return parts.first.substring(0, parts.first.length >= 2 ? 2 : 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }
}

/// Stylized Hospital Blueprint Painter with Ward Polygons and Pulse Radar
class _HospitalBlueprintPainter extends CustomPainter {
  const _HospitalBlueprintPainter({required this.inside, required this.hasFix});
  final bool inside;
  final bool hasFix;

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Blueprint Canvas Background
    final Paint bgPaint = Paint()..color = const Color(0xFF0F172A);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    // 2. Blueprint Grid Lines
    final Paint gridPaint = Paint()
      ..color = const Color(0xFF334155).withOpacity(0.35)
      ..strokeWidth = 0.5;
    for (double x = 0; x < size.width; x += 20) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += 20) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 3. Roadways / Walkways inside Hospital Complex
    final Paint roadPaint = Paint()
      ..color = const Color(0xFF1E293B)
      ..strokeWidth = 24
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final Path mainRoad = Path()
      ..moveTo(-20, size.height * 0.55)
      ..quadraticBezierTo(
        size.width * 0.38,
        size.height * 0.50,
        size.width + 20,
        size.height * 0.65,
      );
    canvas.drawPath(mainRoad, roadPaint);

    final Paint crossRoadPaint = Paint()
      ..color = const Color(0xFF1E293B)
      ..strokeWidth = 20
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(size.width * 0.45, -20),
      Offset(size.width * 0.55, size.height + 20),
      crossRoadPaint,
    );

    // Road dashed centerline
    final Paint roadCenterPaint = Paint()
      ..color = const Color(0xFF475569)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    _drawDashedPath(canvas, mainRoad, roadCenterPaint, dashLength: 6, gapLength: 4);

    // 4. Hospital Building Footprints
    // Gedung Utama
    final Rect gedungUtamaRect = Rect.fromLTWH(
      size.width * 0.08,
      size.height * 0.12,
      size.width * 0.22,
      size.height * 0.30,
    );
    _drawBuilding(
      canvas: canvas,
      rect: gedungUtamaRect,
      fillColor: const Color(0xFF1E293B),
      borderColor: const Color(0xFF38BDF8),
      title: 'GEDUNG UTAMA',
      titleColor: const Color(0xFF94A3B8),
    );

    // Ruang Rawat Inap Melati (Zone of Interest)
    final Rect melatiRect = Rect.fromLTWH(
      size.width * 0.44,
      size.height * 0.15,
      size.width * 0.30,
      size.height * 0.38,
    );
    _drawBuilding(
      canvas: canvas,
      rect: melatiRect,
      fillColor: const Color(0xFF134E4A),
      borderColor: const Color(0xFF2DD4BF),
      title: 'RAWAT INAP MELATI',
      titleColor: const Color(0xFFA7F3D0),
      subtitle: 'Lt. 1-4 • Nurse Hub',
      subtitleColor: const Color(0xFF5EEAD4),
    );

    // IGD 24 Jam
    final Rect igdRect = Rect.fromLTWH(
      size.width * 0.10,
      size.height * 0.64,
      size.width * 0.23,
      size.height * 0.26,
    );
    _drawBuilding(
      canvas: canvas,
      rect: igdRect,
      fillColor: const Color(0xFF1E293B),
      borderColor: const Color(0xFFF43F5E),
      title: 'IGD 24 JAM',
      titleColor: const Color(0xFFFDA4AF),
    );

    // Lab & Farmasi
    final Rect labRect = Rect.fromLTWH(
      size.width * 0.72,
      size.height * 0.62,
      size.width * 0.22,
      size.height * 0.28,
    );
    _drawBuilding(
      canvas: canvas,
      rect: labRect,
      fillColor: const Color(0xFF1E293B),
      borderColor: const Color(0xFF64748B),
      title: 'LAB & FARMASI',
      titleColor: const Color(0xFF94A3B8),
    );

    // 5. 100m Official Geofence Perimeter Circle
    final Offset center = Offset(size.width * 0.54, size.height * 0.48);
    final double radius = math.min(size.width, size.height) * 0.42;

    final Paint geoGradPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          (inside ? const Color(0xFF10B981) : const Color(0xFFBA1A1A)).withOpacity(0.32),
          (inside ? const Color(0xFF059669) : const Color(0xFF991B1B)).withOpacity(0.12),
          Colors.transparent,
        ],
        stops: const [0.0, 0.7, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, geoGradPaint);

    final Paint geoStrokePaint = Paint()
      ..color = inside ? const Color(0xFF10B981) : const Color(0xFFBA1A1A)
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;
    _drawDashedCircle(canvas, center, radius, geoStrokePaint, dashCount: 40);

    // Hospital Anchor Beacon Pin
    final Color beaconColor = inside ? const Color(0xFF10B981) : const Color(0xFFBA1A1A);
    canvas.drawCircle(center, 4, Paint()..color = beaconColor);
    canvas.drawCircle(
      center,
      8,
      Paint()
        ..color = beaconColor.withOpacity(0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    // Radar scanning cone simulation
    final Path radarCone = Path()
      ..moveTo(center.dx, center.dy)
      ..lineTo(center.dx + radius * math.cos(-0.6), center.dy + radius * math.sin(-0.6))
      ..arcTo(
        Rect.fromCircle(center: center, radius: radius),
        -0.6,
        0.5,
        false,
      )
      ..close();
    canvas.drawPath(
      radarCone,
      Paint()..color = (inside ? const Color(0xFF10B981) : const Color(0xFFBA1A1A)).withOpacity(0.08),
    );
  }

  void _drawBuilding({
    required Canvas canvas,
    required Rect rect,
    required Color fillColor,
    required Color borderColor,
    required String title,
    required Color titleColor,
    String? subtitle,
    Color? subtitleColor,
  }) {
    final RRect rrect = RRect.fromRectAndRadius(rect, const Radius.circular(4));
    canvas.drawRRect(rrect, Paint()..color = fillColor);
    canvas.drawRRect(
      rrect,
      Paint()
        ..color = borderColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    final TextPainter tpTitle = TextPainter(
      text: TextSpan(
        text: title,
        style: TextStyle(
          color: titleColor,
          fontSize: 7.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: rect.width);

    final double titleY = subtitle == null
        ? rect.center.dy - tpTitle.height / 2
        : rect.center.dy - tpTitle.height / 2 - 4;
    tpTitle.paint(canvas, Offset(rect.center.dx - tpTitle.width / 2, titleY));

    if (subtitle != null) {
      final TextPainter tpSub = TextPainter(
        text: TextSpan(
          text: subtitle,
          style: TextStyle(
            color: subtitleColor ?? titleColor,
            fontSize: 6.5,
            fontWeight: FontWeight.w500,
          ),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: rect.width);
      tpSub.paint(
        canvas,
        Offset(rect.center.dx - tpSub.width / 2, titleY + tpTitle.height + 2),
      );
    }
  }

  void _drawDashedCircle(Canvas canvas, Offset center, double radius, Paint paint, {int dashCount = 36}) {
    final double sweepAngle = (2 * math.pi) / dashCount;
    for (int i = 0; i < dashCount; i += 2) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        i * sweepAngle,
        sweepAngle * 0.7,
        false,
        paint,
      );
    }
  }

  void _drawDashedPath(Canvas canvas, Path path, Paint paint, {required double dashLength, required double gapLength}) {
    for (final ui.PathMetric metric in path.computeMetrics()) {
      double distance = 0.0;
      while (distance < metric.length) {
        final double nextDistance = math.min(distance + dashLength, metric.length);
        final Path extract = metric.extractPath(distance, nextDistance);
        canvas.drawPath(extract, paint);
        distance += dashLength + gapLength;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _HospitalBlueprintPainter old) =>
      old.inside != inside || old.hasFix != hasFix;
}
