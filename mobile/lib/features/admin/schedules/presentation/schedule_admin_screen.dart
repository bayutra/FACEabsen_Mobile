import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/schedule_admin_repository.dart';

class ScheduleAdminScreen extends StatefulWidget {
  const ScheduleAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<ScheduleAdminScreen> createState() => _ScheduleAdminScreenState();
}

class _ScheduleAdminScreenState extends State<ScheduleAdminScreen> {
  late final ScheduleAdminRepository _repo =
      ScheduleAdminRepository(dio: widget.dio);

  late DateTime _from;
  late DateTime _to;

  AdminSchedulePage? _page;
  String? _error;
  bool _loading = true;
  int _pageNo = 1;

  @override
  void initState() {
    super.initState();
    final DateTime now = DateTime.now();
    _from = DateTime(now.year, now.month, 1);
    _to = DateTime(now.year, now.month + 1, 0);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final AdminSchedulePage page = await _repo.list(
        from: _from,
        to: _to,
        page: _pageNo,
      );
      if (!mounted) return;
      setState(() {
        _page = page;
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

  Future<void> _pickFrom() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _from,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035, 12, 31),
      helpText: 'Pilih tanggal awal',
      cancelText: 'Batal',
      confirmText: 'Pilih',
      fieldLabelText: 'Tanggal awal',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _from = DateTime(picked.year, picked.month, picked.day);
      if (_to.isBefore(_from)) _to = _from;
      _pageNo = 1;
    });
    await _load();
  }

  Future<void> _pickTo() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _to,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035, 12, 31),
      helpText: 'Pilih tanggal akhir',
      cancelText: 'Batal',
      confirmText: 'Pilih',
      fieldLabelText: 'Tanggal akhir',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _to = DateTime(picked.year, picked.month, picked.day);
      if (_from.isAfter(_to)) _from = _to;
      _pageNo = 1;
    });
    await _load();
  }

  Future<void> _resetRange() async {
    final DateTime now = DateTime.now();
    setState(() {
      _from = DateTime(now.year, now.month, 1);
      _to = DateTime(now.year, now.month + 1, 0);
      _pageNo = 1;
    });
    await _load();
  }

  Future<void> _openForm() async {
    if (!mounted) return;
    final bool? saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (BuildContext ctx) => _ScheduleFormSheet(repo: _repo),
    );
    if (saved == true && mounted) {
      showAdminSnack(context, 'Jadwal ditambahkan.');
      _pageNo = 1;
      await _load();
    }
  }

  Future<void> _delete(AdminScheduleEntry entry) async {
    final bool ok = await confirmAdminAction(
      context,
      title: 'Hapus jadwal?',
      message: '${entry.employeeName} (${entry.employeeNo}) akan dilepas dari '
          'shift ${entry.shiftName} pada '
          '${adminShortDate(entry.workDate)}. Riwayat presensi yang sudah '
          'tercatat tidak terhapus.',
      confirmLabel: 'Hapus',
      destructive: true,
    );
    if (!ok || !mounted) return;

    try {
      await _repo.delete(entry.id);
      if (!mounted) return;
      showAdminSnack(context, 'Jadwal dihapus.');
      await _load();
      if (mounted && (_page?.items.isEmpty ?? false) && _pageNo > 1) {
        _pageNo--;
        await _load();
      }
    } catch (e) {
      if (!mounted) return;
      showAdminSnack(context, adminErrorText(e), error: true);
    }
  }

  Widget _dateButton(String label, DateTime date, VoidCallback onTap) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        alignment: Alignment.centerLeft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            label,
            style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
          ),
          const SizedBox(height: 2),
          Text(adminShortDate(date), style: AppText.bodyMdMedium),
        ],
      ),
    );
  }

  Widget _rangeCard() {
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: _dateButton('Dari', _from, _pickFrom)),
              const SizedBox(width: 8),
              Expanded(child: _dateButton('Sampai', _to, _pickTo)),
            ],
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: _resetRange,
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              label: const Text('Bulan ini'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading && _page == null) {
      return const LoadingState(label: 'Memuat jadwal');
    }
    if (_error != null && _page == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final List<AdminScheduleEntry> items =
        _page?.items ?? const <AdminScheduleEntry>[];
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
          _rangeCard(),
          const SizedBox(height: 12),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Column(
                children: <Widget>[
                  const AdminEmpty(
                    icon: Icons.event_busy_outlined,
                    title: 'Belum ada jadwal',
                    subtitle: 'Tugaskan shift kepada karyawan aktif pada '
                        'rentang tanggal ini.',
                  ),
                  FilledButton.icon(
                    onPressed: _openForm,
                    icon: const Icon(Icons.add),
                    label: const Text('Tambah Jadwal'),
                  ),
                ],
              ),
            )
          else
            for (final AdminScheduleEntry entry in items) ...<Widget>[
              AdminTile(
                icon: Icons.event_available_outlined,
                title: entry.employeeName,
                subtitle: '${adminShortDate(entry.workDate)} · '
                    '${entry.shiftName} ${entry.shiftStart}–'
                    '${entry.shiftEnd}'
                    '${entry.shiftOvernight ? ' (+1 hari)' : ''}\n'
                    'NIP ${entry.employeeNo}',
                trailing: IconButton(
                  tooltip: 'Hapus jadwal',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _delete(entry),
                  icon: const Icon(
                    Icons.delete_outline,
                    color: AppColors.error,
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          AdminPager(
            page: _page?.page ?? 1,
            totalPages: _page?.totalPages ?? 1,
            onChanged: (int page) {
              _pageNo = page;
              _load();
            },
          ),
          const SizedBox(height: 16),
          Text(
            'Total ${_page?.totalItems ?? 0} jadwal pada rentang ini',
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
      title: 'Jadwal',
      subtitle: '${adminShortDate(_from)} – ${adminShortDate(_to)}',
      actions: <Widget>[
        IconButton(
          tooltip: 'Tambah jadwal',
          onPressed: _openForm,
          icon: const Icon(Icons.add),
        ),
      ],
      child: _body(),
    );
  }
}

class _ScheduleFormSheet extends StatefulWidget {
  const _ScheduleFormSheet({required this.repo});

  final ScheduleAdminRepository repo;

  @override
  State<_ScheduleFormSheet> createState() => _ScheduleFormSheetState();
}

class _ScheduleFormSheetState extends State<_ScheduleFormSheet> {
  List<AdminScheduleEmployee> _employees = const <AdminScheduleEmployee>[];
  List<AdminShiftOption> _shifts = const <AdminShiftOption>[];

  String? _employeeId;
  String? _shiftId;
  DateTime _workDate = DateTime.now();
  String? _loadError;
  String? _error;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final List<AdminScheduleEmployee> employees =
          await widget.repo.activeEmployees();
      final List<AdminShiftOption> shifts = await widget.repo.shiftOptions();
      if (!mounted) return;
      setState(() {
        _employees = employees;
        _shifts = shifts;
        _employeeId = employees.isEmpty ? null : employees.first.id;
        _shiftId = shifts.isEmpty ? null : shifts.first.id;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = adminErrorText(e);
        _loading = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _workDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035, 12, 31),
      helpText: 'Pilih tanggal kerja',
      cancelText: 'Batal',
      confirmText: 'Pilih',
      fieldLabelText: 'Tanggal kerja',
    );
    if (picked == null || !mounted) return;
    setState(() {
      _workDate = DateTime(picked.year, picked.month, picked.day);
    });
  }

  Future<void> _save() async {
    if (_employeeId == null || _shiftId == null) {
      setState(() => _error = 'Pilih karyawan dan shift terlebih dahulu.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repo.create(
        employeeId: _employeeId!,
        shiftId: _shiftId!,
        workDate: _workDate,
      );
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

  Widget _form() {
    final bool canSave = _employees.isNotEmpty && _shifts.isNotEmpty;
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const Expanded(
                child: Text('Jadwal Baru', style: AppText.headlineSm),
              ),
              IconButton(
                tooltip: 'Tutup',
                onPressed:
                    _saving ? null : () => Navigator.of(context).pop(false),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_employees.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: InfoBanner(
                'Belum ada karyawan aktif. Aktifkan karyawan terlebih dahulu '
                'di menu Karyawan.',
                tone: InfoBannerTone.warning,
                title: 'Karyawan aktif kosong',
              ),
            ),
          if (_shifts.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: InfoBanner(
                'Belum ada shift pada rumah sakit ini. Buat shift terlebih '
                'dahulu di menu Shift Kerja.',
                tone: InfoBannerTone.warning,
                title: 'Shift belum tersedia',
              ),
            ),
          DropdownButtonFormField<String>(
            value: _employeeId,
            isExpanded: true,
            menuMaxHeight: 320,
            decoration: const InputDecoration(labelText: 'Karyawan aktif'),
            items: <DropdownMenuItem<String>>[
              for (final AdminScheduleEmployee employee in _employees)
                DropdownMenuItem<String>(
                  value: employee.id,
                  child: Text(
                    employee.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: _employees.isEmpty
                ? null
                : (String? value) => setState(() => _employeeId = value),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _shiftId,
            isExpanded: true,
            menuMaxHeight: 320,
            decoration: const InputDecoration(labelText: 'Shift'),
            items: <DropdownMenuItem<String>>[
              for (final AdminShiftOption shift in _shifts)
                DropdownMenuItem<String>(
                  value: shift.id,
                  child: Text(
                    shift.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: _shifts.isEmpty
                ? null
                : (String? value) => setState(() => _shiftId = value),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(AppColors.radiusInput),
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Tanggal kerja'),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      adminShortDate(_workDate),
                      style: AppText.bodyMdMedium,
                    ),
                  ),
                  const Icon(Icons.calendar_today_outlined, size: 18),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Satu karyawan hanya boleh memiliki satu shift per tanggal.',
            style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
          ),
          if (_error != null) ...<Widget>[
            const SizedBox(height: 12),
            InfoBanner(_error!, tone: InfoBannerTone.error),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _saving || !canSave ? null : _save,
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
    );
  }

  Widget _content() {
    if (_loading) {
      return const SizedBox(
        height: 220,
        child: LoadingState(label: 'Memuat karyawan & shift'),
      );
    }
    if (_loadError != null) {
      return SizedBox(
        height: 280,
        child: AdminError(message: _loadError!, onRetry: _loadOptions),
      );
    }
    return _form();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: _content(),
        ),
      ),
    );
  }
}
