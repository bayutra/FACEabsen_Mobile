import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../data/leave_repository.dart';
import '../domain/leave_models.dart';
import '../../../core/theme/app_colors.dart';

String _formatIdDate(DateTime d) {
  const List<String> bulan = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  return '${d.day} ${bulan[d.month - 1]} ${d.year}';
}

String _weekdayName(DateTime d) {
  const List<String> hari = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu'
  ];
  return hari[d.weekday - 1];
}

class LeaveFormScreen extends StatefulWidget {
  const LeaveFormScreen({
    super.key,
    required this.leaves,
    this.displayName = 'Karyawan',
    this.employeeNo = '—',
  });

  final LeaveRepository leaves;
  final String displayName;
  final String employeeNo;

  @override
  State<LeaveFormScreen> createState() => _LeaveFormScreenState();
}

class _LeaveFormScreenState extends State<LeaveFormScreen> {
  String _type = 'CUTI';
  DateTime _start = DateTime.now();
  DateTime _end = DateTime.now();
  final _reason = TextEditingController();
  bool _agreed = true;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

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

  Future<void> _pick(bool isStart) async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _start : _end,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              onSurface: AppColors.ink,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      if (!mounted) return;
      setState(() {
        if (isStart) {
          _start = picked;
          if (_end.isBefore(_start)) _end = _start;
        } else {
          _end = picked;
        }
      });
    }
  }

  Future<void> _submit() async {
    final String startKey = toDateKey(_start);
    final String endKey = toDateKey(_end);
    if (!validLeaveRange(startKey, endKey)) {
      setState(() => _error = 'Tanggal selesai sebelum tanggal mulai.');
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = 'Alasan wajib diisi.');
      return;
    }
    if (!_agreed) {
      setState(() =>
          _error = 'Harap menyetujui pernyataan SOP koordinasi dengan Karu.');
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      await widget.leaves.create(
        type: _type,
        startDate: startKey,
        endDate: endKey,
        reason: _reason.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.response?.statusCode == 409
            ? 'Sudah ada izin/cuti pada rentang tanggal itu.'
            : 'Pengajuan gagal (${e.response?.statusCode ?? 'tanpa kode'}).';
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Pengajuan gagal. Periksa koneksi ke server SIMRS.';
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final String startKey = toDateKey(_start);
    final String endKey = toDateKey(_end);
    final int days = leaveDays(startKey, endKey);

    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      appBar: AppBar(
        title: const Text('Pengajuan Izin & Cuti'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink,
        elevation: 0,
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
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
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
                            const Text(
                              'Karyawan Rumah Sakit',
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.inkSecondary),
                            ),
                            Text(
                              'NIP: ${widget.employeeNo}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.outline),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.event_available,
                              size: 16, color: AppColors.primary),
                          SizedBox(width: 6),
                          Text(
                            'Hak Cuti Tahunan',
                            style: TextStyle(
                                fontSize: 12, color: AppColors.inkSecondary),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primaryFixed.withOpacity(0.4),
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusFull),
                          border: Border.all(
                              color: AppColors.primary.withOpacity(0.2)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.verified,
                                size: 12, color: AppColors.primary),
                            SizedBox(width: 4),
                            Text(
                              'Kuota tahun berjalan',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '1. Jenis Dispensasi / Cuti',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink),
                ),
                Text(
                  'Wajib Diisi',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary),
                ),
              ],
            ),
            const SizedBox(height: 8),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.5,
              children: [
                _leaveTypeCard(
                  type: 'CUTI',
                  title: 'Cuti Tahunan',
                  subtitle: 'Potong Kuota',
                  icon: Icons.beach_access,
                ),
                _leaveTypeCard(
                  type: 'SAKIT',
                  title: 'Sakit / Rawat Medis',
                  subtitle: 'Lampirkan Ket. Dokter',
                  icon: Icons.medical_services,
                ),
                _leaveTypeCard(
                  type: 'IZIN',
                  title: 'Izin Pribadi',
                  subtitle: 'Maksimal 2 Hari',
                  icon: Icons.person,
                ),
                _leaveTypeCard(
                  type: 'DINAS',
                  title: 'Dinas / Diklat',
                  subtitle: 'Disposisi Direksi',
                  icon: Icons.school,
                ),
              ],
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => setState(() => _type = 'LAINNYA'),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color:
                      _type == 'LAINNYA' ? AppColors.surfaceLow : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _type == 'LAINNYA'
                        ? AppColors.primary
                        : AppColors.border.withOpacity(0.6),
                    width: _type == 'LAINNYA' ? 1.8 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Radio<String>(
                      value: 'LAINNYA',
                      groupValue: _type,
                      activeColor: AppColors.primary,
                      onChanged: (v) => setState(() => _type = v ?? _type),
                    ),
                    const Text(
                      'Alasan Lainnya (Melahirkan, Kedukaan, Khusus)',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.ink),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '2. Rentang Waktu Dispensasi',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink),
                      ),
                      Text(
                        'Kalender Shift',
                        style: TextStyle(
                            fontSize: 11,
                            color: AppColors.secondary,
                            fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => _pick(true),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.canvas,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: AppColors.border.withOpacity(0.6)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Tanggal Mulai',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.outline)),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _formatIdDate(_start),
                                      style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.ink),
                                    ),
                                    const Icon(Icons.event,
                                        size: 18, color: AppColors.primary),
                                  ],
                                ),
                                Text(
                                  _weekdayName(_start),
                                  style: const TextStyle(
                                      fontSize: 11, color: AppColors.outline),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: InkWell(
                          onTap: () => _pick(false),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.canvas,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: AppColors.border.withOpacity(0.6)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Tanggal Selesai',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.outline)),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _formatIdDate(_end),
                                      style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.ink),
                                    ),
                                    const Icon(Icons.event,
                                        size: 18, color: AppColors.primary),
                                  ],
                                ),
                                Text(
                                  _weekdayName(_end),
                                  style: const TextStyle(
                                      fontSize: 11, color: AppColors.outline),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.timelapse,
                                size: 16, color: AppColors.primary),
                            const SizedBox(width: 6),
                            Text(
                              'Total: $days Hari Kerja',
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.ink),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusFull),
                          ),
                          child: Text(
                            'Mengganti $days Shift Dinas',
                            style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Colors.white),
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
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '3. Delegasi / Pengganti Jaga Shift',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink),
                      ),
                      Text(
                        'SOP Bangsal',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Wajib menunjuk rekan perawat yang tidak berdinas pada tanggal yang sama.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.outline),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.secondary.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.primaryContainer,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.person,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Rekan Pengganti Jaga',
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink),
                              ),
                              Text(
                                'Perawat Pelaksana',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.inkSecondary),
                              ),
                              Text(
                                '✓ Telah Konfirmasi Kesediaan',
                                style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.swap_horiz,
                              color: AppColors.secondary),
                          onPressed: () {},
                          tooltip: 'Ganti Rekan Jaga',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '4. Alasan / Keterangan Keperluan',
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _reason,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText:
                          'Tuliskan keterangan detail keperluan izin Anda...',
                      hintStyle: const TextStyle(
                          fontSize: 12.5, color: AppColors.outline),
                      contentPadding: const EdgeInsets.all(12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                            color: AppColors.primary, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border.withOpacity(0.6)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(
                    value: _agreed,
                    activeColor: AppColors.primary,
                    onChanged: (v) => setState(() => _agreed = v ?? true),
                  ),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 10),
                      child: Text(
                        'Saya menyatakan bahwa data permohonan ini benar dan telah dikoordinasikan secara lisan/tertulis dengan Kepala Ruangan (Karu) atau Supervisor bangsal.',
                        style: TextStyle(
                            fontSize: 11.5, color: AppColors.ink, height: 1.35),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.errorTint,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.error),
                ),
                child: Text(_error!,
                    style: const TextStyle(
                        color: AppColors.errorText, fontSize: 12)),
              ),
            ],
            const SizedBox(height: 18),
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryContainer,
                  foregroundColor: Colors.white,
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _busy ? null : _submit,
                icon: const Icon(Icons.send, size: 18),
                label: Text(
                  _busy ? 'Mengirim Permohonan...' : 'Ajukan Permohonan Izin',
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _leaveTypeCard({
    required String type,
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    final bool isSelected = _type == type;
    return InkWell(
      onTap: () => setState(() => _type = type),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primaryContainer.withOpacity(0.1)
              : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : AppColors.border.withOpacity(0.6),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon,
                    color:
                        isSelected ? AppColors.primary : AppColors.inkSecondary,
                    size: 22),
                if (isSelected)
                  const Icon(Icons.check_circle,
                      color: AppColors.primary, size: 18)
                else
                  Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.border),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isSelected ? AppColors.primary : AppColors.ink,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 10, color: AppColors.outline),
            ),
          ],
        ),
      ),
    );
  }
}
