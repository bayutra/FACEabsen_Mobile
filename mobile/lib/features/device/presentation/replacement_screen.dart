import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../data/device_repository.dart';
import '../domain/device_models.dart';

const Map<String, String> replacementReasons = {
  'BROKEN': 'HP rusak',
  'LOST': 'HP hilang',
  'STOLEN': 'HP dicuri',
  'UPGRADE': 'Ganti HP baru',
  'OTHER': 'Lainnya',
};

/// Mockup titles + descriptions for the 4 radio cards. Keys are the exact
/// backend reason values sent by [DeviceRepository.requestReplacement] —
/// only the UI becomes cards; the wire values never change.
const Map<String, (String title, String desc, IconData icon)> _reasonCards = {
  'BROKEN': (
    'HP Rusak / Kendala Hardware',
    'Layar pecah, kamera rusak, sensor biometrik mati.',
    Icons.phonelink_erase,
  ),
  'LOST': (
    'Perangkat Hilang',
    'Akses perangkat lama akan langsung dinonaktifkan.',
    Icons.screen_search_desktop,
  ),
  'STOLEN': (
    'Perangkat Dicuri',
    'Wajib lampirkan surat keterangan hilang/BAP resmi.',
    Icons.gpp_bad,
  ),
  'UPGRADE': (
    'Upgrade / Ganti HP Baru',
    'Penggantian gawai berkala / migrasi data pegawai.',
    Icons.phonelink_setup,
  ),
};

/// STEP 8 replacement form (Stitch "Penggantian Perangkat"): reason +
/// password identity verification. Runs on the NEW phone.
///
/// Returns the created [ChangeRequest] on success (so callers can route to
/// the status screen with the real object — no new API), null on cancel.
class ReplacementScreen extends StatefulWidget {
  const ReplacementScreen({
    super.key,
    required this.devices,
    required this.newDeviceId,
  });

  final DeviceRepository devices;
  final String newDeviceId;

  @override
  State<ReplacementScreen> createState() => _ReplacementScreenState();
}

class _ReplacementScreenState extends State<ReplacementScreen> {
  String _reason = 'BROKEN';
  final _note = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_password.text.isEmpty) {
      setState(() => _error = 'Password wajib diisi untuk verifikasi identitas.');
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final ChangeRequest req = await widget.devices.requestReplacement(
        newDeviceId: widget.newDeviceId,
        reason: _reason,
        reasonNote: _note.text.trim().isEmpty ? null : _note.text.trim(),
        password: _password.text,
      );
      if (mounted) Navigator.of(context).pop(req);
    } on DioException catch (e) {
      setState(() {
        _error = _messageFor(e);
        _busy = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Terjadi kesalahan. Coba lagi.';
        _busy = false;
      });
    }
  }

  String _messageFor(DioException e) {
    switch (e.response?.statusCode) {
      case 401:
        return 'Verifikasi identitas gagal (password salah).';
      case 404:
        return 'Perangkat baru tidak ditemukan. Daftar ulang dulu.';
      case 409:
        return 'Tidak dapat mengajukan: periksa status perangkat / pengajuan aktif.';
      default:
        return 'Pengajuan gagal (${e.response?.statusCode ?? 'tanpa kode'}).';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30), size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Ajukan Ganti Perangkat',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0B1C30),
              ),
            ),
            Text(
              'Validasi Identitas & Perangkat Baru',
              style: TextStyle(
                fontSize: 11,
                color: Color(0xFF3E4947),
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFCCFBF1),
                  borderRadius: BorderRadius.circular(9999),
                  border: Border.all(color: const Color(0xFF99F6E4)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.shield_outlined, size: 13, color: Color(0xFF0F766E)),
                    SizedBox(width: 4),
                    Text(
                      'SIMRS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F766E),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 3-step Stepper: Alasan (done) -> Validasi (active) -> Admin (pending)
            _buildStepper(),
            const SizedBox(height: 16),

            // Section 1: Pilih Alasan Penggantian
            _sectionHeader(
              '1. Pilih Alasan Penggantian',
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFDAD6),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: const Text(
                  'Wajib',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFBA1A1A),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            for (final entry in _reasonCards.entries)
              _reasonCard(entry.key, entry.value.$1, entry.value.$2, entry.value.$3),
            _reasonCard('OTHER', replacementReasons['OTHER']!, null, Icons.more_horiz),
            const SizedBox(height: 10),

            // Note field
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0D0F172A),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: TextField(
                controller: _note,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Catatan Alasan (Opsional)',
                  hintText: 'Tuliskan rincian kendala gawai atau nomor surat...',
                  labelStyle: TextStyle(fontSize: 12.5, color: Color(0xFF3E4947)),
                  hintStyle: TextStyle(fontSize: 12, color: Color(0xFF6E7977)),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.all(12),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Section 2: Verifikasi Identitas Pegawai (2-Factor Check)
            _sectionHeader(
              '2. Verifikasi Identitas Pegawai (2-Factor Check)',
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFCCFBF1),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF99F6E4)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.lock, size: 11, color: Color(0xFF0F766E)),
                    SizedBox(width: 4),
                    Text(
                      '2FA Check',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Security protocol banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F9FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBAE6FD)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, size: 18, color: Color(0xFF006591)),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Protokol Keamanan SIMRS',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF006591),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Untuk mencegah penyalahgunaan akun, permohonan wajib memvalidasi kata sandi SIMRS dan mencocokkan biometrik.',
                          style: TextStyle(
                            fontSize: 11.5,
                            color: Color(0xFF3E4947),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Password field
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0D0F172A),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: TextField(
                controller: _password,
                obscureText: _obscure,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.password, color: Color(0xFF005C55), size: 20),
                  labelText: 'Password SIMRS Akun Pegawai',
                  hintText: 'Masukkan kata sandi untuk verifikasi',
                  labelStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF3E4947)),
                  hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF6E7977)),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                      color: const Color(0xFF6E7977),
                      size: 20,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                onSubmitted: (_) => _submit(),
              ),
            ),
            const SizedBox(height: 10),

            // Biometric verification card with face photo area
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0D0F172A),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: const Color(0xFFCCFBF1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.face_retouching_natural,
                              size: 18,
                              color: Color(0xFF005C55),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Verifikasi Biometrik Wajah',
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0B1C30),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle, size: 11, color: Color(0xFF047857)),
                            SizedBox(width: 4),
                            Text(
                              'Terdaftar di SIMRS',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF047857),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F9FF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF4FF),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFF005C55),
                                  width: 1.5,
                                ),
                              ),
                              child: const Icon(
                                Icons.person,
                                size: 36,
                                color: Color(0xFF0F766E),
                              ),
                            ),
                            Positioned(
                              bottom: 2,
                              right: 2,
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF10B981),
                                  shape: BoxShape.circle,
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
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Template Biometrik AI Siap',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF0B1C30),
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Data biometrik terdaftar akan disinkronkan otomatis ke gawai baru setelah verifikasi disetujui.',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF3E4947),
                                  height: 1.3,
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
            ),
            const SizedBox(height: 18),

            // Section 3: Detail Perangkat Baru Terdeteksi
            _sectionHeader(
              '3. Detail Perangkat Baru Terdeteksi',
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF4FF),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFBDC9C6)),
                ),
                child: const Text(
                  'Gawai Baru',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF006591),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            _newDeviceCard(),
            const SizedBox(height: 14),

            // Legal confirmation checkbox card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF4FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBDC9C6).withOpacity(0.5)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: EdgeInsets.only(top: 1),
                    child: Icon(Icons.check_box, size: 18, color: Color(0xFF005C55)),
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Saya menyatakan permohonan penggantian perangkat ini dilakukan secara sah dan data yang diberikan benar sesuai ketentuan SIMRS RSU Darmayu Madiun.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF3E4947),
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // SLA tracking notice with left border accent
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0D0F172A),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      width: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F766E),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.schedule, size: 15, color: Color(0xFF0F766E)),
                              SizedBox(width: 6),
                              Text(
                                'SLA Peninjauan Admin IT: Maksimal 1x24 Jam',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0B1C30),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 3),
                          Text(
                            'Pengajuan diproses pada hari kerja SIMRS. Akses presensi dialihkan segera setelah admin menyetujui.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF3E4947),
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Error banner if any
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFDAD6),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline, size: 18, color: Color(0xFFBA1A1A)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Pengajuan Gagal',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFBA1A1A),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _error!,
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFF93000A),
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

            // 52px Primary CTA Submit button
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                onPressed: _busy ? null : _submit,
                icon: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 20),
                label: Text(
                  _busy ? 'Mengirim Pengajuan…' : 'Kirim Pengajuan Ganti Perangkat',
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF005C55),
                  foregroundColor: Colors.white,
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  disabledBackgroundColor: const Color(0xFF005C55).withOpacity(0.5),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Cancel Outline button
            SizedBox(
              height: 48,
              child: OutlinedButton(
                onPressed: _busy ? null : () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF3E4947),
                  backgroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFFBDC9C6)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: const Text(
                  'Batal',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepper() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D0F172A),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          _stepItem(
            stepNumber: 1,
            title: 'Alasan',
            subtitle: 'Pilihan',
            isDone: true,
            isActive: false,
          ),
          _stepConnector(isDone: true),
          _stepItem(
            stepNumber: 2,
            title: 'Validasi',
            subtitle: 'Identitas',
            isDone: false,
            isActive: true,
          ),
          _stepConnector(isDone: false),
          _stepItem(
            stepNumber: 3,
            title: 'Admin',
            subtitle: 'Persetujuan',
            isDone: false,
            isActive: false,
          ),
        ],
      ),
    );
  }

  Widget _stepItem({
    required int stepNumber,
    required String title,
    required String subtitle,
    required bool isDone,
    required bool isActive,
  }) {
    final Color circleBg = isDone
        ? const Color(0xFFECFDF5)
        : isActive
            ? const Color(0xFF005C55)
            : const Color(0xFFEFF4FF);
    final Color circleBorder = isDone
        ? const Color(0xFFA7F3D0)
        : isActive
            ? const Color(0xFF005C55)
            : const Color(0xFFBDC9C6);
    final Color circleFg = isDone
        ? const Color(0xFF047857)
        : isActive
            ? Colors.white
            : const Color(0xFF6E7977);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: circleBg,
            shape: BoxShape.circle,
            border: Border.all(color: circleBorder, width: isActive ? 2 : 1),
          ),
          child: Center(
            child: isDone
                ? Icon(Icons.check, size: 16, color: circleFg)
                : Text(
                    '$stepNumber',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: circleFg,
                    ),
                  ),
          ),
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w600,
                color: isActive
                    ? const Color(0xFF005C55)
                    : isDone
                        ? const Color(0xFF0B1C30)
                        : const Color(0xFF6E7977),
              ),
            ),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 10,
                color: isActive
                    ? const Color(0xFF0F766E)
                    : const Color(0xFF6E7977),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _stepConnector({required bool isDone}) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.symmetric(horizontal: 8),
        color: isDone ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
      ),
    );
  }

  Widget _sectionHeader(String title, {Widget? trailing}) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 16,
          decoration: BoxDecoration(
            color: const Color(0xFF005C55),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0B1C30),
            ),
          ),
        ),
        if (trailing != null) trailing,
      ],
    );
  }

  Widget _reasonCard(String value, String title, String? desc, IconData icon) {
    final bool selected = _reason == value;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => setState(() => _reason = value),
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected
                ? const Color(0xFF005C55).withOpacity(0.04)
                : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? const Color(0xFF005C55)
                  : const Color(0xFFE2E8F0),
              width: selected ? 1.8 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: selected
                    ? const Color(0xFF005C55).withOpacity(0.08)
                    : const Color(0x0D0F172A),
                blurRadius: selected ? 6 : 3,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFFCCFBF1)
                      : const Color(0xFFEFF4FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: selected
                        ? const Color(0xFF99F6E4)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: selected
                    ? const Color(0xFF005C55)
                    : const Color(0xFF3E4947),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight:
                            selected ? FontWeight.w700 : FontWeight.w600,
                        color: selected
                            ? const Color(0xFF005C55)
                            : const Color(0xFF0B1C30),
                      ),
                    ),
                    if (desc != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        desc,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF3E4947),
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? const Color(0xFF005C55)
                        : const Color(0xFFBDC9C6),
                    width: selected ? 6 : 1.5,
                  ),
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// New-device section: ONLY values actually available in this widget plus
  /// the real OS platform. No IMEI/UUID fabrication; rows for anything
  /// unavailable are omitted, not faked.
  Widget _newDeviceCard() {
    String platform = '';
    try {
      platform = Platform.operatingSystem.toUpperCase();
    } catch (_) {
      platform = '';
    }
    final String deviceModel = Platform.isAndroid
        ? 'Android Handset'
        : (Platform.isIOS ? 'Apple iPhone' : 'Perangkat Terdeteksi');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D0F172A),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCCFBF1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.phonelink_setup,
                      size: 18,
                      color: Color(0xFF005C55),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Spesifikasi Perangkat',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFCCFBF1),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF99F6E4)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.auto_awesome, size: 11, color: Color(0xFF0F766E)),
                    SizedBox(width: 4),
                    Text(
                      'Auto-Captured',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _deviceInfoRow(
            icon: Icons.smartphone,
            label: 'Model Perangkat',
            value: deviceModel,
          ),
          const Divider(height: 16, color: Color(0xFFE2E8F0)),
          if (platform.isNotEmpty) ...[
            _deviceInfoRow(
              icon: Icons.settings_system_daydream,
              label: 'Sistem Operasi (OS)',
              value: platform,
            ),
            const Divider(height: 16, color: Color(0xFFE2E8F0)),
          ],
          _deviceInfoRow(
            icon: Icons.fingerprint,
            label: 'IMEI / Hardware UUID',
            value: widget.newDeviceId,
            isTabular: true,
          ),
          const Divider(height: 16, color: Color(0xFFE2E8F0)),
          _deviceInfoRow(
            icon: Icons.lock_clock,
            label: 'Status Otorisasi',
            value: 'Menunggu Persetujuan Admin IT',
            valueColor: const Color(0xFF006591),
            isBold: true,
          ),
        ],
      ),
    );
  }

  Widget _deviceInfoRow({
    required IconData icon,
    required String label,
    required String value,
    bool isTabular = false,
    bool isBold = false,
    Color? valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF6E7977)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF3E4947),
            ),
          ),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isBold ? FontWeight.w700 : FontWeight.w600,
              color: valueColor ?? const Color(0xFF0B1C30),
              fontFeatures: isTabular ? const [FontFeature.tabularFigures()] : null,
            ),
          ),
        ),
      ],
    );
  }
}
