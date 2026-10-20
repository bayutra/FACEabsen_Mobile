import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/report_admin_repository.dart';
import '../domain/report_admin_models.dart';

/// Laporan kehadiran (SUPERVISOR ke atas): harian, bulanan, keterlambatan,
/// izin/cuti, per departemen, dan per karyawan. Semua data diambil dari
/// endpoint `/reports/*` — tidak ada data tiruan.
class ReportAdminScreen extends StatefulWidget {
  const ReportAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<ReportAdminScreen> createState() => _ReportAdminScreenState();
}

class _ReportAdminScreenState extends State<ReportAdminScreen> {
  late final ReportAdminRepository _repo =
      ReportAdminRepository(dio: widget.dio);

  ReportKind _kind = ReportKind.daily;

  final DateTime _now = DateTime.now();
  late DateTime _date = DateTime(_now.year, _now.month, _now.day);
  late DateTime _month = DateTime(_now.year, _now.month);
  late DateTime _from = DateTime(_now.year, _now.month, 1);
  late DateTime _to = DateTime(_now.year, _now.month + 1, 0);

  AdminReport? _report;
  String? _error;
  bool _loading = true;

  List<AdminEmployeeOption> _employees = const <AdminEmployeeOption>[];
  String? _employeeId;
  bool _employeesLoading = false;
  String? _employeesError;

  @override
  void initState() {
    super.initState();
    _loadEmployees();
    _load();
  }

  Future<void> _loadEmployees() async {
    setState(() => _employeesLoading = true);
    try {
      final List<AdminEmployeeOption> list = await _repo.employees();
      if (!mounted) return;
      setState(() {
        _employees = list;
        _employeesError = null;
        _employeesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _employeesError = adminErrorText(e);
        _employeesLoading = false;
      });
    }
  }

  Future<void> _load() async {
    if (_kind == ReportKind.employee && (_employeeId?.isEmpty ?? true)) {
      setState(() {
        _report = null;
        _error = null;
        _loading = false;
      });
      return;
    }

    setState(() => _loading = true);
    try {
      final bool single =
          _kind == ReportKind.daily || _kind == ReportKind.monthly;
      final AdminReport report = await _repo.fetch(
        _kind,
        date: _kind == ReportKind.daily ? adminDate(_date) : null,
        month: _kind == ReportKind.monthly ? _monthKey(_month) : null,
        from: single ? null : adminDate(_from),
        to: single ? null : adminDate(_to),
        employeeId: _kind == ReportKind.employee ? _employeeId : null,
      );
      if (!mounted) return;
      setState(() {
        _report = report;
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

  Future<void> _pickDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035, 12, 31),
      helpText: 'Pilih tanggal',
      cancelText: 'Batal',
      confirmText: 'Pilih',
      fieldLabelText: 'Tanggal laporan',
    );
    if (picked == null || !mounted) return;
    setState(() => _date = DateTime(picked.year, picked.month, picked.day));
    await _load();
  }

  Future<void> _pickMonth() async {
    final DateTime? picked = await showDialog<DateTime>(
      context: context,
      builder: (BuildContext ctx) =>
          _MonthPickerDialog(year: _month.year, month: _month.month),
    );
    if (picked == null || !mounted) return;
    setState(() => _month = picked);
    await _load();
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
    });
    await _load();
  }

  Widget _rangeFields() {
    return Row(
      children: <Widget>[
        Expanded(
          child: _DateField(
            label: 'Dari',
            value: adminShortDate(_from),
            icon: Icons.today_outlined,
            onTap: _pickFrom,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _DateField(
            label: 'Sampai',
            value: adminShortDate(_to),
            icon: Icons.event_outlined,
            onTap: _pickTo,
          ),
        ),
      ],
    );
  }

  Widget _employeeField() {
    if (_employeesLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: LoadingState(label: 'Memuat daftar karyawan'),
      );
    }
    if (_employeesError != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          InfoBanner(_employeesError!, tone: InfoBannerTone.error),
          TextButton.icon(
            onPressed: _loadEmployees,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Coba lagi'),
          ),
        ],
      );
    }
    return DropdownButtonFormField<String>(
      value: _employeeId,
      isExpanded: true,
      menuMaxHeight: 320,
      decoration: const InputDecoration(labelText: 'Karyawan'),
      items: <DropdownMenuItem<String>>[
        for (final AdminEmployeeOption e in _employees)
          DropdownMenuItem<String>(
            value: e.id,
            child: Text(
              e.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
      ],
      onChanged: _employees.isEmpty
          ? null
          : (String? value) {
              setState(() => _employeeId = value);
              _load();
            },
    );
  }

  Widget _controls() {
    switch (_kind) {
      case ReportKind.daily:
        return _DateField(
          label: 'Tanggal',
          value: adminShortDate(_date),
          icon: Icons.today_outlined,
          onTap: _pickDate,
        );
      case ReportKind.monthly:
        return _DateField(
          label: 'Bulan',
          value: _monthLabel(_month),
          icon: Icons.calendar_month_outlined,
          onTap: _pickMonth,
        );
      case ReportKind.lateness:
      case ReportKind.leaves:
      case ReportKind.department:
        return _rangeFields();
      case ReportKind.employee:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _rangeFields(),
            const SizedBox(height: 8),
            _employeeField(),
          ],
        );
    }
  }

  Widget _reportHeader(AdminReport report) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(report.title, style: AppText.headlineSm),
          const SizedBox(height: 4),
          Row(
            children: <Widget>[
              const Icon(Icons.schedule,
                  size: 14, color: AppColors.inkSecondary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Dibuat ${adminDateTime(report.generatedAt)}',
                  style:
                      AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryWrap(List<ReportSummaryItem> summary) {
    if (summary.isEmpty) return const SizedBox.shrink();
    final double width =
        (MediaQuery.of(context).size.width - AppColors.pageMargin * 2 - 8) / 2;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: <Widget>[
        for (final ReportSummaryItem item in summary)
          SizedBox(
            width: width,
            child: AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    item.label,
                    style:
                        AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  MetricReadout(item.value, size: 26),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _body() {
    if (_loading && _report == null) {
      return const LoadingState(label: 'Memuat laporan');
    }
    if (_error != null && _report == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final AdminReport? report = _report;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          AdminFilterChips(
            values: <String>[
              for (final ReportKind k in ReportKind.values) k.code,
            ],
            selected: _kind.code,
            labels: <String, String>{
              for (final ReportKind k in ReportKind.values) k.code: k.label,
            },
            onChanged: (String? code) {
              if (code == null) return;
              setState(() => _kind = ReportKind.fromCode(code));
              _load();
            },
          ),
          const SizedBox(height: 8),
          _controls(),
          const SizedBox(height: 16),
          if (report == null)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: AdminEmpty(
                icon: _kind == ReportKind.employee
                    ? Icons.person_search_outlined
                    : Icons.description_outlined,
                title: _kind == ReportKind.employee
                    ? 'Pilih karyawan'
                    : 'Belum ada laporan',
                subtitle: _kind == ReportKind.employee
                    ? 'Pilih karyawan untuk melihat laporannya.'
                    : 'Atur filter lalu muat ulang.',
              ),
            )
          else ...<Widget>[
            _reportHeader(report),
            const SizedBox(height: 12),
            _summaryWrap(report.summary),
            const SizedBox(height: 16),
            const SectionHeader('Rincian'),
            if (report.isEmpty)
              const AdminEmpty(
                icon: Icons.table_rows_outlined,
                title: 'Tidak ada baris data',
                subtitle: 'Laporan ini kosong untuk rentang yang dipilih.',
              )
            else
              _ReportTable(headers: report.headers, rows: report.rows),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Laporan',
      subtitle: _report?.title ?? 'Rekap kehadiran',
      actions: <Widget>[
        IconButton(
          tooltip: 'Muat ulang',
          onPressed: _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: _body(),
    );
  }
}

const List<String> _monthNames = <String>[
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

String _monthLabel(DateTime d) => '${_monthNames[d.month - 1]} ${d.year}';

String _monthKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';

/// Kartu pemilih tanggal/bulan yang membuka date picker.
class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppColors.radiusInput),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceLowest,
          border: Border.all(color: AppColors.inputBorder),
          borderRadius: BorderRadius.circular(AppColors.radiusInput),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 18, color: AppColors.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    label,
                    style:
                        AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                  ),
                  Text(value, style: AppText.bodyMdMedium),
                ],
              ),
            ),
            const Icon(Icons.expand_more,
                size: 18, color: AppColors.inkSecondary),
          ],
        ),
      ),
    );
  }
}

/// Dialog pemilih bulan-tahun (tanpa paket tambahan).
class _MonthPickerDialog extends StatefulWidget {
  const _MonthPickerDialog({required this.year, required this.month});

  final int year;
  final int month;

  @override
  State<_MonthPickerDialog> createState() => _MonthPickerDialogState();
}

class _MonthPickerDialogState extends State<_MonthPickerDialog> {
  static const List<String> _names = _monthNames;
  late int _year = widget.year;
  late int _month = widget.month;

  @override
  Widget build(BuildContext context) {
    final List<int> years = <int>[for (int y = 2020; y <= 2035; y++) y];
    return AlertDialog(
      title: const Text('Pilih bulan'),
      content: Row(
        children: <Widget>[
          Expanded(
            child: DropdownButtonFormField<int>(
              value: _month,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Bulan'),
              items: <DropdownMenuItem<int>>[
                for (int m = 1; m <= 12; m++)
                  DropdownMenuItem<int>(value: m, child: Text(_names[m - 1])),
              ],
              onChanged: (int? value) {
                if (value != null) setState(() => _month = value);
              },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButtonFormField<int>(
              value: _year,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Tahun'),
              items: <DropdownMenuItem<int>>[
                for (final int year in years)
                  DropdownMenuItem<int>(value: year, child: Text('$year')),
              ],
              onChanged: (int? value) {
                if (value != null) setState(() => _year = value);
              },
            ),
          ),
        ],
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Batal'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(DateTime(_year, _month)),
          child: const Text('Pilih'),
        ),
      ],
    );
  }
}

/// Tabel laporan yang bisa di-scroll horizontal.
class _ReportTable extends StatelessWidget {
  const _ReportTable({required this.headers, required this.rows});

  final List<String> headers;
  final List<List<String>> rows;

  @override
  Widget build(BuildContext context) {
    final double pageWidth =
        MediaQuery.of(context).size.width - AppColors.pageMargin * 2;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: ConstrainedBox(
        constraints: BoxConstraints(minWidth: pageWidth),
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(AppColors.surfaceLow),
          columnSpacing: 20,
          horizontalMargin: 12,
          columns: <DataColumn>[
            for (final String header in headers)
              DataColumn(label: Text(header, style: AppText.labelMd)),
          ],
          rows: <DataRow>[
            for (final List<String> row in rows)
              DataRow(
                cells: <DataCell>[
                  for (int i = 0; i < headers.length; i++)
                    DataCell(
                      Text(
                        i < row.length ? row[i] : '',
                        style: AppText.bodyMd,
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
