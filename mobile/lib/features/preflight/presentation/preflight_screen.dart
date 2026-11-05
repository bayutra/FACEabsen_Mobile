// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:face_absen_mobile/core/theme/app_colors.dart';

import '../data/preflight_repository.dart';
import '../domain/eligibility.dart';
import 'preflight_sections.dart';

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
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.ink),
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
                color: AppColors.ink,
                fontSize: 17,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
              ),
            ),
            Text(
              'Pemeriksaan Sistem Sebelum Absen',
              style: TextStyle(
                color: AppColors.inkSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh,
                color: AppColors.inkSecondary, size: 20),
            tooltip: 'Muat Ulang',
          ),
          Container(
            margin: const EdgeInsets.only(right: 16, left: 4),
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.verified_user,
              color: AppColors.primary,
              size: 18,
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            color: AppColors.border.withOpacity(0.35),
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
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
            ),
            SizedBox(height: 16),
            Text(
              'Memeriksa Parameter Presensi...',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Memeriksa perangkat dan jadwal shift',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: AppColors.inkSecondary,
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
            border: Border.all(color: AppColors.border.withOpacity(0.5)),
            boxShadow: [
              BoxShadow(
                color: AppColors.ink.withOpacity(0.04),
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
                  color: AppColors.roseTint,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.error_outline,
                  color: AppColors.error,
                  size: 24,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Gagal Memeriksa Parameter',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _error ?? 'Tidak ada data presensi yang ditemukan.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.inkSecondary,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 44,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
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
        identityCard(s),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Parameter Kelayakan Presensi',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
              decoration: BoxDecoration(
                color: ready ? AppColors.successTint : AppColors.warningTint,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color:
                      ready ? AppColors.successBorder : AppColors.warningBorder,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: ready ? AppColors.success : AppColors.warning,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$passed/${gates.length} Terpenuhi',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color:
                          ready ? AppColors.successText : AppColors.warningText,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final GateResult g in gates) ...[
          gateCard(g, s),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 4),
        readinessBanner(ready, blocking),
      ],
    );
  }

  Widget _bottomActionZone(
      BuildContext context, bool ready, List<GateResult> blocking) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: AppColors.border.withOpacity(0.35)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!ready) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warningTint,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.warningBorder),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      color: AppColors.warningText, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      blocking.isEmpty
                          ? 'Ada parameter yang belum terpenuhi.'
                          : 'Perbaiki: ${blocking.map((GateResult g) => g.title).join(', ')}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.warningText,
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
                backgroundColor: AppColors.primary,
                disabledBackgroundColor: AppColors.border,
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
}
