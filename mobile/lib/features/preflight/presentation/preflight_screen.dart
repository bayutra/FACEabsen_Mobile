import 'package:flutter/material.dart';

import '../data/preflight_repository.dart';
import '../domain/eligibility.dart';

class PreflightScreen extends StatefulWidget {
  const PreflightScreen(
      {super.key, required this.preflight, required this.onProceed});

  final PreflightRepository preflight;
  final ValueChanged<PreflightSnapshot> onProceed;

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
        _error = 'Gagal menjalankan pemeriksaan. Periksa koneksi.';
        _busy = false;
      });
    }
  }

  List<GateResult> _gates(PreflightSnapshot s) => [
        evaluateAccount(isActive: s.isActive, hasProfile: s.hasProfile),
        evaluateSchedule(
          hasShift: s.shift != null,
          window: s.shift?.window,
          name: s.shift?.shiftName,
          shift: s.shift,
          now: DateTime.now(),
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
            tooltip: 'Muat Ulang',
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
      bottomNavigationBar:
          hasData ? _bottomActionZone(context, ready, blocking) : null,
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
              'Memeriksa perangkat dan jadwal shift',
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
        _identityCard(s),
        const SizedBox(height: 16),
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
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
              decoration: BoxDecoration(
                color:
                    ready ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color:
                      ready ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: ready
                          ? const Color(0xFF10B981)
                          : const Color(0xFFF59E0B),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$passed/${gates.length} Terpenuhi',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: ready
                          ? const Color(0xFF047857)
                          : const Color(0xFFB45309),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final GateResult g in gates) ...[
          _gateCard(g, s),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 4),
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
                                        ? const Color(0xFF005C55)
                                            .withOpacity(0.25)
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
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
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
      GateId.schedule => _scheduleGateCard(g, s),
    };
  }

  Widget _deviceGateCard(GateResult g, PreflightSnapshot s) {
    final (Color fg, Color bg, IconData icon) = switch (g.state) {
      GateState.pass => (
          const Color(0xFF047857),
          const Color(0xFFECFDF5),
          Icons.check_circle
        ),
      GateState.warn => (
          const Color(0xFFB45309),
          const Color(0xFFFFFBEB),
          Icons.error_outline
        ),
      GateState.fail => (
          const Color(0xFFB91C1C),
          const Color(0xFFFEF2F2),
          Icons.cancel
        ),
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
          BoxShadow(
              color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
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
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
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
                    const Icon(Icons.fingerprint,
                        size: 13, color: Color(0xFF64748B)),
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
                      s.isActive
                          ? 'Keamanan Knox Aktif'
                          : 'Status Perangkat Tidak Sah',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: s.isActive
                            ? const Color(0xFF047857)
                            : const Color(0xFFB91C1C),
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

  Widget _scheduleGateCard(GateResult g, PreflightSnapshot s) {
    final (Color fg, Color bg, IconData icon) = switch (g.state) {
      GateState.pass => (
          const Color(0xFF047857),
          const Color(0xFFECFDF5),
          Icons.check_circle
        ),
      GateState.warn => (
          const Color(0xFFB45309),
          const Color(0xFFFFFBEB),
          Icons.error_outline
        ),
      GateState.fail => (
          const Color(0xFFB91C1C),
          const Color(0xFFFEF2F2),
          Icons.cancel
        ),
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
          BoxShadow(
              color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
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
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
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
                if (s.shift != null) ...[
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF3E4947)),
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
                  ),
                  if (g.state != GateState.pass)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        g.detail,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: fg,
                        ),
                      ),
                    ),
                ] else
                  Text(
                    g.detail,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF3E4947)),
                  ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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

  Widget _bottomActionZone(
      BuildContext context, bool ready, List<GateResult> blocking) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: const Color(0xFFBDC9C6).withOpacity(0.35)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!ready) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      color: Color(0xFFB45309), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      blocking.isEmpty
                          ? 'Ada parameter yang belum terpenuhi.'
                          : 'Perbaiki: ${blocking.map((GateResult g) => g.title).join(', ')}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              onPressed: ready ? () => widget.onProceed(_snap!) : null,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF005C55),
                disabledBackgroundColor: const Color(0xFFBDC9C6),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(
                ready
                    ? 'Lanjutkan ke Verifikasi Wajah'
                    : 'Parameter Tidak Terpenuhi',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _readinessBanner(bool ready, List<GateResult> blocking) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ready ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: ready ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
        ),
      ),
      child: Row(
        children: [
          Icon(
            ready ? Icons.check_circle : Icons.info_outline,
            color: ready ? const Color(0xFF047857) : const Color(0xFFB45309),
            size: 22,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ready ? 'Siap Melakukan Presensi' : 'Ada Perlu Diperbaik',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: ready
                        ? const Color(0xFF047857)
                        : const Color(0xFF92400E),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  ready
                      ? 'Semua parameter terpenuhi. Lanjutkan ke verifikasi wajah.'
                      : 'Selesaikan parameter yang ditandai sebelum melanjutkan.',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: ready
                        ? const Color(0xFF047857)
                        : const Color(0xFF92400E),
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _initials(String name) {
    final List<String> parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts[1][0]).toUpperCase();
  }
}
