import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/shift_admin_repository.dart';


class ShiftAdminScreen extends StatefulWidget {
  const ShiftAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<ShiftAdminScreen> createState() => _ShiftAdminScreenState();
}

class _ShiftAdminScreenState extends State<ShiftAdminScreen> {
  late final ShiftAdminRepository _repo = ShiftAdminRepository(dio: widget.dio);

  List<ShiftHospital> _hospitals = const <ShiftHospital>[];
  List<AdminShift> _shifts = const <AdminShift>[];
  String? _hospitalId;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final List<ShiftHospital> hospitals = await _repo.hospitals();
      String? selected = _hospitalId;
      if (selected == null ||
          !hospitals.any((ShiftHospital h) => h.id == selected)) {
        selected = hospitals.isEmpty ? null : hospitals.first.id;
      }
      final List<AdminShift> shifts = await _repo.list(hospitalId: selected);
      if (!mounted) return;
      setState(() {
        _hospitals = hospitals;
        _hospitalId = selected;
        _shifts = shifts;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = adminErrorText(e);
        _loading = false;
      });
    }
  }

  Future<void> _openForm([AdminShift? shift]) async {
    if (shift == null && _hospitals.isEmpty) {
      showAdminSnack(
        context,
        'Belum ada rumah sakit yang bisa dipilih. Muat ulang lalu coba lagi.',
        error: true,
      );
      return;
    }
    if (!mounted) return;

    final bool? saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (BuildContext ctx) => _ShiftFormSheet(
        repo: _repo,
        hospitals: _hospitals,
        defaultHospitalId: _hospitalId,
        shift: shift,
      ),
    );
    if (saved == true && mounted) {
      showAdminSnack(
        context,
        shift == null ? 'Shift ditambahkan.' : 'Shift diperbarui.',
      );
      await _load();
    }
  }

  Future<void> _delete(AdminShift shift) async {
    final bool ok = await confirmAdminAction(
      context,
      title: 'Hapus shift ${shift.name}?',
      message: 'Shift yang masih dipakai pada jadwal karyawan tidak dapat '
          'dihapus. Lepaskan jadwalnya terlebih dahulu agar presensi tetap '
          'konsisten.',
      confirmLabel: 'Hapus',
      destructive: true,
    );
    if (!ok || !mounted) return;

    try {
      await _repo.delete(shift.id);
      if (!mounted) return;
      showAdminSnack(context, 'Shift ${shift.name} dihapus.');
      await _load();
    } catch (e) {
      if (!mounted) return;
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  Widget _hospitalPicker() {
    if (_hospitals.length <= 1) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        value: _hospitalId,
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'Rumah sakit'),
        items: <DropdownMenuItem<String>>[
          for (final ShiftHospital hospital in _hospitals)
            DropdownMenuItem<String>(
              value: hospital.id,
              child: Text(hospital.label),
            ),
        ],
        onChanged: (String? value) {
          if (value == null) return;
          setState(() => _hospitalId = value);
          _load();
        },
      ),
    );
  }

  Widget _shiftCard(AdminShift shift) {
    return AppCard(
      accent: shift.overnight ? AppColors.interactive : null,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  shift.name,
                  style: AppText.bodyMdMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (shift.overnight)
                const AppPill(
                  'Lintas hari',
                  AppColors.tealBadgeBg,
                  AppColors.tealBadgeText,
                  border: AppColors.tealBadgeBorder,
                ),
              PopupMenuButton<String>(
                tooltip: 'Aksi shift',
                onSelected: (String value) {
                  if (value == 'edit') {
                    _openForm(shift);
                  } else if (value == 'delete') {
                    _delete(shift);
                  }
                },
                itemBuilder: (BuildContext ctx) =>
                    const <PopupMenuEntry<String>>[
                  PopupMenuItem<String>(
                    value: 'edit',
                    child: Text('Ubah shift'),
                  ),
                  PopupMenuItem<String>(
                    value: 'delete',
                    child: Text('Hapus'),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: <Widget>[
              const Icon(
                Icons.schedule,
                size: 16,
                color: AppColors.primary,
              ),
              const SizedBox(width: 6),
              Text(
                '${shift.startTime} – ${shift.endTime}',
                style: AppText.metricSmall(size: 14),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Toleransi ${shift.gracePeriodMin} mnt · '
            'Terlambat ${shift.lateThresholdMin} mnt · '
            'Pulang awal ${shift.earlyCheckoutThresholdMin} mnt',
            style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading && _shifts.isEmpty) {
      return const LoadingState(label: 'Memuat shift');
    }
    if (_error != null && _shifts.isEmpty) {
      return AdminError(message: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          if (_error != null) ...<Widget>[
            InfoBanner(_error!, tone: InfoBannerTone.error),
            const SizedBox(height: 12),
          ],
          if (_hospitals.isEmpty) ...<Widget>[
            const InfoBanner(
              'Belum ada rumah sakit terdaftar. Shift baru tidak dapat dibuat '
              'sebelum rumah sakit tersedia.',
              tone: InfoBannerTone.warning,
              title: 'Master fasilitas kosong',
            ),
            const SizedBox(height: 12),
          ],
          _hospitalPicker(),
          if (_shifts.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Column(
                children: <Widget>[
                  const AdminEmpty(
                    icon: Icons.schedule_outlined,
                    title: 'Belum ada shift',
                    subtitle: 'Buat pola jam kerja seperti Pagi, Siang, '
                        'atau Malam.',
                  ),
                  FilledButton.icon(
                    onPressed: () => _openForm(),
                    icon: const Icon(Icons.add),
                    label: const Text('Tambah Shift'),
                  ),
                ],
              ),
            )
          else
            for (final AdminShift shift in _shifts) ...<Widget>[
              _shiftCard(shift),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 24),
          Text(
            'Total ${_shifts.length} shift',
            style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Shift Kerja',
      subtitle: 'Jam kerja & ambang toleransi',
      actions: <Widget>[
        IconButton(
          tooltip: 'Tambah shift',
          onPressed: () => _openForm(),
          icon: const Icon(Icons.add),
        ),
      ],
      child: _body(),
    );
  }
}

class _ShiftFormSheet extends StatefulWidget {
  const _ShiftFormSheet({
    required this.repo,
    required this.hospitals,
    required this.defaultHospitalId,
    this.shift,
  });

  final ShiftAdminRepository repo;
  final List<ShiftHospital> hospitals;
  final String? defaultHospitalId;
  final AdminShift? shift;

  @override
  State<_ShiftFormSheet> createState() => _ShiftFormSheetState();
}

class _ShiftFormSheetState extends State<_ShiftFormSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  late final TextEditingController _name;
  late final TextEditingController _grace;
  late final TextEditingController _late;
  late final TextEditingController _early;

  late TimeOfDay _start;
  late TimeOfDay _end;
  late bool _overnight;
  String? _hospitalId;
  String? _error;
  bool _saving = false;

  bool get _editing => widget.shift != null;

  @override
  void initState() {
    super.initState();
    final AdminShift? shift = widget.shift;
    _name = TextEditingController(text: shift?.name ?? '');
    _grace = TextEditingController(
      text: '${shift?.gracePeriodMin ?? 15}',
    );
    _late = TextEditingController(
      text: '${shift?.lateThresholdMin ?? 30}',
    );
    _early = TextEditingController(
      text: '${shift?.earlyCheckoutThresholdMin ?? 15}',
    );
    _start = _parseTime(shift?.startTime ?? '07:00');
    _end = _parseTime(shift?.endTime ?? '14:00');
    _overnight = shift?.overnight ?? false;
    _hospitalId = shift?.hospitalId ??
        widget.defaultHospitalId ??
        (widget.hospitals.isEmpty ? null : widget.hospitals.first.id);
  }

  @override
  void dispose() {
    _name.dispose();
    _grace.dispose();
    _late.dispose();
    _early.dispose();
    super.dispose();
  }

  static TimeOfDay _parseTime(String value) {
    final List<String> parts = value.split(':');
    final int hour = (int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 7)
        .clamp(0, 23)
        .toInt();
    final int minute = (int.tryParse(parts.length > 1 ? parts[1] : '') ?? 0)
        .clamp(0, 59)
        .toInt();
    return TimeOfDay(hour: hour, minute: minute);
  }

  static String _hhmm(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:'
      '${time.minute.toString().padLeft(2, '0')}';

  static int _minutes(TimeOfDay time) => time.hour * 60 + time.minute;

  Future<void> _pickStart() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _start,
      helpText: 'Pilih jam mulai',
      cancelText: 'Batal',
      confirmText: 'Pilih',
      hourLabelText: 'Jam',
      minuteLabelText: 'Menit',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _start = picked;
      _overnight = _minutes(_end) < _minutes(_start);
    });
  }

  Future<void> _pickEnd() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _end,
      helpText: 'Pilih jam selesai',
      cancelText: 'Batal',
      confirmText: 'Pilih',
      hourLabelText: 'Jam',
      minuteLabelText: 'Menit',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _end = picked;
      _overnight = _minutes(_end) < _minutes(_start);
    });
  }

  String? _validateName(String? value) {
    final String name = (value ?? '').trim();
    if (name.length < 2) return 'Minimal 2 karakter.';
    if (name.length > 32) return 'Maksimal 32 karakter.';
    return null;
  }

  String? _validateCount(String? value) {
    final String text = (value ?? '').trim();
    if (text.isEmpty) return 'Wajib diisi.';
    final int? number = int.tryParse(text);
    if (number == null) return 'Masukkan angka bulat.';
    if (number < 0) return 'Tidak boleh negatif.';
    return null;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final int startMinutes = _minutes(_start);
    final int endMinutes = _minutes(_end);
    if (startMinutes == endMinutes) {
      setState(() => _error = 'Jam mulai dan jam selesai tidak boleh sama.');
      return;
    }
    final bool derivedOvernight = endMinutes < startMinutes;
    if (derivedOvernight != _overnight) {
      setState(() {
        _error = derivedOvernight
            ? 'Jam selesai lebih awal dari jam mulai. Aktifkan "Lintas hari".'
            : 'Jam selesai setelah jam mulai. Nonaktifkan "Lintas hari".';
      });
      return;
    }
    if (!_editing && _hospitalId == null) {
      setState(() => _error = 'Pilih rumah sakit terlebih dahulu.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final String start = _hhmm(_start);
      final String end = _hhmm(_end);
      final int grace = int.parse(_grace.text.trim());
      final int late = int.parse(_late.text.trim());
      final int early = int.parse(_early.text.trim());
      if (_editing) {
        await widget.repo.update(
          widget.shift!.id,
          name: _name.text,
          startTime: start,
          endTime: end,
          overnight: _overnight,
          gracePeriodMin: grace,
          lateThresholdMin: late,
          earlyCheckoutThresholdMin: early,
        );
      } else {
        await widget.repo.create(
          hospitalId: _hospitalId!,
          name: _name.text,
          startTime: start,
          endTime: end,
          overnight: _overnight,
          gracePeriodMin: grace,
          lateThresholdMin: late,
          earlyCheckoutThresholdMin: early,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = adminErrorText(e);
      });
    }
  }

  Widget _hospitalField() {
    if (_editing) {
      final AdminShift shift = widget.shift!;
      final String label = shift.hospitalName.isEmpty
          ? 'Rumah sakit tidak diketahui'
          : shift.hospitalName;
      return InputDecorator(
        decoration: const InputDecoration(
          labelText: 'Rumah sakit',
          helperText: 'Rumah sakit tidak dapat diubah.',
        ),
        child: Text(label, style: AppText.bodyMdMedium),
      );
    }
    return DropdownButtonFormField<String>(
      value: _hospitalId,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Rumah sakit'),
      items: <DropdownMenuItem<String>>[
        for (final ShiftHospital hospital in widget.hospitals)
          DropdownMenuItem<String>(
            value: hospital.id,
            child: Text(hospital.label),
          ),
      ],
      onChanged: (String? value) => setState(() => _hospitalId = value),
      validator: (String? value) => value == null ? 'Pilih rumah sakit.' : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        _editing ? 'Ubah Shift' : 'Shift Baru',
                        style: AppText.headlineSm,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Tutup',
                      onPressed: _saving
                          ? null
                          : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _name,
                  autofocus: true,
                  maxLength: 32,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Nama shift',
                    hintText: 'Contoh: Pagi',
                  ),
                  validator: _validateName,
                ),
                const SizedBox(height: 8),
                _hospitalField(),
                const SizedBox(height: 12),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: _TimeField(
                        label: 'Jam mulai',
                        value: _hhmm(_start),
                        onTap: _pickStart,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _TimeField(
                        label: 'Jam selesai',
                        value: _hhmm(_end),
                        onTap: _pickEnd,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Lintas hari'),
                  subtitle: const Text(
                    'Shift berakhir pada hari berikutnya (mis. 23:00 → 07:00).',
                  ),
                  value: _overnight,
                  onChanged: (bool value) => setState(() => _overnight = value),
                ),
                const SizedBox(height: 4),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: TextFormField(
                        controller: _grace,
                        keyboardType: TextInputType.number,
                        inputFormatters: <TextInputFormatter>[
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Toleransi (mnt)',
                        ),
                        validator: _validateCount,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextFormField(
                        controller: _late,
                        keyboardType: TextInputType.number,
                        inputFormatters: <TextInputFormatter>[
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Terlambat (mnt)',
                        ),
                        validator: _validateCount,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextFormField(
                        controller: _early,
                        keyboardType: TextInputType.number,
                        inputFormatters: <TextInputFormatter>[
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Pulang awal (mnt)',
                        ),
                        validator: _validateCount,
                      ),
                    ),
                  ],
                ),
                if (_error != null) ...<Widget>[
                  const SizedBox(height: 12),
                  InfoBanner(_error!, tone: InfoBannerTone.error),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: Text(_saving ? 'Menyimpan…' : 'Simpan'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TimeField extends StatelessWidget {
  const _TimeField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppColors.radiusInput),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: const Icon(Icons.schedule, size: 20),
        ),
        child: Text(value, style: AppText.metricSmall(size: 14)),
      ),
    );
  }
}
