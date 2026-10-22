import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/stitch.dart';
import '../../presentation/admin_widgets.dart';
import '../data/team_admin_repository.dart';
import '../domain/team_admin_models.dart';




class TeamAdminScreen extends StatefulWidget {
  const TeamAdminScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<TeamAdminScreen> createState() => _TeamAdminScreenState();
}

class _TeamAdminScreenState extends State<TeamAdminScreen> {
  late final TeamAdminRepository _repo = TeamAdminRepository(dio: widget.dio);

  final DateTime _now = DateTime.now();
  late DateTime _from = DateTime(_now.year, _now.month, 1);
  late DateTime _to = DateTime(_now.year, _now.month + 1, 0);

  TeamSummary? _summary;
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
      final TeamSummary summary = await _repo.summary(
        from: adminDate(_from),
        to: adminDate(_to),
      );
      if (!mounted) return;
      setState(() {
        _summary = summary;
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

  void _openMember(TeamMember member) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (BuildContext ctx) => _MemberSheet(
        repo: _repo,
        member: member,
        from: adminDate(_from),
        to: adminDate(_to),
      ),
    );
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

  String _memberSubtitle(TeamMember m) {
    final String base =
        m.position == null ? m.subtitle : '${m.subtitle} Â· ${m.position}';
    if (m.days.isEmpty) return base;
    return '$base Â· ${m.daySummary}';
  }

  Widget _totals(TeamTotals totals) {
    final List<(String, int)> items = <(String, int)>[
      ('Anggota', totals.members),
      ('Hadir', totals.present),
      ('Terlambat', totals.late),
      ('Tidak hadir', totals.absent),
      ('Izin/cuti', totals.onLeave),
    ];
    final double width =
        (MediaQuery.of(context).size.width - AppColors.pageMargin * 2 - 8) / 2;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: <Widget>[
        for (final (String label, int value) in items)
          SizedBox(
            width: width,
            child: AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    label,
                    style:
                        AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                  ),
                  const SizedBox(height: 2),
                  MetricReadout('$value', size: 26),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _body() {
    if (_loading && _summary == null) {
      return const LoadingState(label: 'Memuat tim');
    }
    if (_error != null && _summary == null) {
      return AdminError(message: _error!, onRetry: _load);
    }

    final TeamSummary? summary = _summary;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppColors.pageMargin),
        children: <Widget>[
          _rangeFields(),
          const SizedBox(height: 12),
          if (summary != null) ...<Widget>[
            _totals(summary.totals),
            const SizedBox(height: 16),
            SectionHeader('Anggota Tim (${summary.totals.members})'),
            if (summary.members.isEmpty)
              const AdminEmpty(
                icon: Icons.group_off_outlined,
                title: 'Tidak ada anggota tim',
                subtitle: 'Tidak ada karyawan dalam cakupan Anda.',
              )
            else
              for (final TeamMember m in summary.members) ...<Widget>[
                AdminTile(
                  icon: Icons.badge_outlined,
                  title: m.name,
                  subtitle: _memberSubtitle(m),
                  onTap: () => _openMember(m),
                ),
                const SizedBox(height: 8),
              ],
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: 'Tim Supervisor',
      subtitle: '${adminShortDate(_from)} â€“ ${adminShortDate(_to)}',
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


class _MemberSheet extends StatefulWidget {
  const _MemberSheet({
    required this.repo,
    required this.member,
    required this.from,
    required this.to,
  });

  final TeamAdminRepository repo;
  final TeamMember member;
  final String from;
  final String to;

  @override
  State<_MemberSheet> createState() => _MemberSheetState();
}

class _MemberSheetState extends State<_MemberSheet> {
  bool _loading = true;
  String? _error;
  TeamMemberDetail? _detail;
  List<TeamAttendance> _fallback = const <TeamAttendance>[];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    TeamMemberDetail? detail;
    String? detailError;
    try {
      detail = await widget.repo.memberDetail(widget.member.id);
    } catch (e) {
      detailError = adminErrorText(e);
    }
    if (!mounted) return;
    if (detail != null && detail.member.id.isNotEmpty) {
      setState(() {
        _detail = detail;
        _error = detailError;
        _loading = false;
      });
      return;
    }

    
    
    try {
      final List<TeamAttendance> all = await widget.repo.attendance(
        from: widget.from,
        to: widget.to,
      );
      if (!mounted) return;
      final String no = widget.member.employeeNo;
      setState(() {
        _fallback =
            all.where((TeamAttendance a) => a.employeeNo == no).toList();
        _error = detailError;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = detailError ?? adminErrorText(e);
        _loading = false;
      });
    }
  }

  List<TeamAttendance> get _attendance {
    final TeamMemberDetail? detail = _detail;
    if (detail != null) return detail.recent;
    return _fallback;
  }

  Widget _summaryRow(TeamMember member) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Wrap(
        spacing: 16,
        runSpacing: 4,
        children: <Widget>[
          _metric('Hadir', member.presentCount),
          _metric('Terlambat', member.lateCount),
          _metric('Absen', member.absentCount),
          _metric('Izin/cuti', member.onLeaveCount),
          _metric('Off', member.offCount),
        ],
      ),
    );
  }

  Widget _metric(String label, int value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
        ),
        MetricReadout('$value', size: 22),
      ],
    );
  }

  Widget _attendanceTile(TeamAttendance a) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(adminShortDate(a.workDate), style: AppText.bodyMdMedium),
                const SizedBox(height: 2),
                Text(
                  '${a.shiftName} Â· Masuk ${_time(a.checkInAt)} Â· '
                  'Pulang ${_time(a.checkOutAt)}',
                  style:
                      AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                ),
              ],
            ),
          ),
          if (a.checkInStatus != null) StatusPill(a.checkInStatus!),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final TeamMember member = widget.member;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(child: Text(member.name, style: AppText.headlineSm)),
                const SizedBox(width: 8),
                AppPill(
                  member.employeeNo.isEmpty ? 'â€”' : member.employeeNo,
                  AppColors.surfaceLow,
                  AppColors.inkSecondary,
                ),
              ],
            ),
            const SizedBox(height: 12),
            DetailRow(
              'NIP',
              member.employeeNo.isEmpty ? 'â€”' : member.employeeNo,
            ),
            DetailRow('Jabatan', member.position ?? 'â€”'),
            DetailRow(
              'Unit',
              member.departmentName.isEmpty ? 'â€”' : member.departmentName,
            ),
            if (member.days.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              const SectionHeader('Ringkasan Kehadiran'),
              _summaryRow(member),
            ],
            const SizedBox(height: 12),
            const SectionHeader('Presensi Terbaru'),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: LoadingState(label: 'Memuat presensi'),
              )
            else if (_error != null) ...<Widget>[
              InfoBanner(_error!, tone: InfoBannerTone.error),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Coba lagi'),
              ),
            ] else
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: <Widget>[
                    if (_attendance.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text('Belum ada presensi pada rentang ini.'),
                      )
                    else
                      for (final TeamAttendance a in _attendance)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _attendanceTile(a),
                        ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

String _time(DateTime? dt) {
  if (dt == null) return 'â€”';
  final DateTime local = dt.toLocal();
  final String hh = local.hour.toString().padLeft(2, '0');
  final String mm = local.minute.toString().padLeft(2, '0');
  return '$hh:$mm';
}
