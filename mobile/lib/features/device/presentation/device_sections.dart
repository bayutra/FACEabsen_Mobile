import 'package:flutter/material.dart';

import '../data/device_repository.dart';
import '../domain/device_models.dart';
import 'helpdesk_sheet.dart';
import '../../../core/theme/app_colors.dart';

class DeviceStatusSection extends StatefulWidget {
  const DeviceStatusSection({
    super.key,
    required this.devices,
    this.employeeName,
    this.employeeNip,
    this.unit,
  });

  final DeviceRepository devices;
  final String? employeeName;
  final String? employeeNip;
  final String? unit;

  @override
  State<DeviceStatusSection> createState() => _DeviceStatusSectionState();
}

class _DeviceStatusSectionState extends State<DeviceStatusSection> {
  late Future<_DeviceInfo> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_DeviceInfo> _load() async {
    final results = await Future.wait([
      widget.devices.myDevices(),
      widget.devices.isCompromised(),
      widget.devices.currentDeviceId(),
    ]);
    return _DeviceInfo(
      devices: results[0] as List<BoundDevice>,
      compromised: results[1] as bool,
      currentId: results[2] as String?,
    );
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _heartbeat(String id) async {
    try {
      await widget.devices.heartbeat(id);
    } finally {
      if (mounted) _reload();
    }
  }

  static String _ago(DateTime when) {
    final Duration d = DateTime.now().difference(when.toLocal());
    if (d.inMinutes < 1) return 'baru saja';
    if (d.inHours < 1) return '${d.inMinutes} menit lalu';
    if (d.inDays < 1) return '${d.inHours} jam lalu';
    return '${d.inDays} hari lalu';
  }

  static Widget _pulseStatusPill(DeviceStatus s) {
    final (
      String label,
      Color dotColor,
      Color glowColor,
      Color bg,
      Color text,
      Color border
    ) = switch (s) {
      DeviceStatus.active => (
          'STATUS: AKTIF',
          AppColors.success,
          const Color(0x6610B981),
          AppColors.successTint,
          AppColors.successText,
          AppColors.successBorder,
        ),
      DeviceStatus.pending => (
          'STATUS: MENUNGGU',
          AppColors.warning,
          const Color(0x66F59E0B),
          AppColors.warningTint,
          AppColors.warningText,
          AppColors.warningBorder,
        ),
      DeviceStatus.revoked => (
          'STATUS: DICABUT',
          AppColors.error,
          const Color(0x66BA1A1A),
          AppColors.errorTint,
          AppColors.errorText,
          AppColors.errorBorder,
        ),
      DeviceStatus.lost => (
          'STATUS: HILANG',
          AppColors.error,
          const Color(0x66BA1A1A),
          AppColors.errorTint,
          AppColors.errorText,
          AppColors.errorBorder,
        ),
      DeviceStatus.replaced => (
          'STATUS: DIGANTI',
          AppColors.secondary,
          const Color(0x66006591),
          AppColors.surfaceContainer,
          AppColors.secondary,
          AppColors.border,
        ),
      DeviceStatus.unknown => (
          'STATUS: LAINNYA',
          AppColors.outline,
          const Color(0x666E7977),
          AppColors.surfaceLow,
          AppColors.inkSecondary,
          AppColors.border,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppColors.radiusFull),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: glowColor,
                  blurRadius: 4,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: text,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  static Widget _historyStatusPill(DeviceStatus s) {
    final (String label, Color bg, Color fg, Color border) = switch (s) {
      DeviceStatus.active => (
          'AKTIF',
          AppColors.successTint,
          AppColors.successText,
          AppColors.successBorder,
        ),
      DeviceStatus.pending => (
          'MENUNGGU',
          AppColors.warningTint,
          AppColors.warningText,
          AppColors.warningBorder,
        ),
      DeviceStatus.revoked => (
          'DICABUT',
          AppColors.errorTint,
          AppColors.errorText,
          AppColors.errorBorder,
        ),
      DeviceStatus.lost => (
          'HILANG',
          AppColors.errorTint,
          AppColors.error,
          AppColors.errorBorder,
        ),
      DeviceStatus.replaced => (
          'DIGANTI',
          AppColors.surfaceContainer,
          AppColors.secondary,
          AppColors.border,
        ),
      DeviceStatus.unknown => (
          'LAINNYA',
          AppColors.surfaceLow,
          AppColors.outline,
          AppColors.border,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppColors.radiusFull),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: fg,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  static Color _historyIconBg(DeviceStatus s) {
    switch (s) {
      case DeviceStatus.active:
        return AppColors.successTint;
      case DeviceStatus.pending:
        return AppColors.warningTint;
      case DeviceStatus.revoked:
      case DeviceStatus.lost:
        return AppColors.errorTint;
      case DeviceStatus.replaced:
        return AppColors.surfaceContainer;
      default:
        return AppColors.surfaceLow;
    }
  }

  static Color _historyIconColor(DeviceStatus s) {
    switch (s) {
      case DeviceStatus.active:
        return AppColors.successText;
      case DeviceStatus.pending:
        return AppColors.warningText;
      case DeviceStatus.revoked:
      case DeviceStatus.lost:
        return AppColors.error;
      case DeviceStatus.replaced:
        return AppColors.secondary;
      default:
        return AppColors.outline;
    }
  }

  Widget _buildPolicyCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withOpacity(0.5)),
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
          const Positioned(
            right: -10,
            bottom: -15,
            child: Icon(
              Icons.local_hospital_rounded,
              size: 92,
              color: Color(0x0D005C55),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.employeeName != null &&
                    widget.employeeName!.isNotEmpty) ...[
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLow,
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: AppColors.border.withOpacity(0.5)),
                        ),
                        child: Center(
                          child: Text(
                            widget.employeeName!.isNotEmpty
                                ? widget.employeeName![0].toUpperCase()
                                : 'K',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
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
                              widget.employeeName!,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              '${widget.employeeNip ?? 'NIP —'}${widget.unit != null ? ' · ${widget.unit}' : ''}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.inkSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(height: 1, color: AppColors.surfaceLow),
                  const SizedBox(height: 12),
                ],
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(
                        Icons.shield_rounded,
                        size: 14,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'KEBIJAKAN INTEGRITAS PERANGKAT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Perangkat Terdaftar Akun Anda',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 3),
                const Text(
                  'Presensi kehadiran dan verifikasi biometrik sah dilakukan dari perangkat yang terdaftar pada akun SIMRS Anda. Lebih dari satu perangkat diperbolehkan.',
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.4,
                    color: AppColors.inkSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoGrid(BoundDevice current, bool compromised) {
    return Column(
      children: [
        Row(
          children: [
            _buildBentoCell(
              icon: Icons.event_available_rounded,
              iconColor: AppColors.primary,
              label: 'REGISTRASI',
              value: current.registeredAt != null
                  ? formatIdDate(current.registeredAt!)
                  : '—',
            ),
            const SizedBox(width: 8),
            _buildBentoCell(
              icon: Icons.access_time_rounded,
              iconColor: AppColors.secondary,
              label: 'TERAKHIR AKTIF',
              value: current.lastSeenAt != null
                  ? _ago(current.lastSeenAt!)
                  : 'Belum pernah',
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _buildBentoCell(
              icon: Icons.devices_rounded,
              iconColor: AppColors.primaryContainer,
              label: 'SISTEM OPERASI',
              value:
                  current.platform.isNotEmpty ? current.platform : 'Mobile OS',
            ),
            const SizedBox(width: 8),
            _buildBentoCell(
              icon: compromised
                  ? Icons.gpp_bad_rounded
                  : Icons.verified_user_rounded,
              iconColor: compromised ? AppColors.error : AppColors.success,
              label: 'STATUS KEAMANAN',
              value: compromised ? 'Berisiko Root' : 'Terverifikasi',
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBentoCell({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceLow,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0x33BDC9C6)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 13, color: iconColor),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: AppColors.outline,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttestationIndicator(bool compromised) {
    if (compromised) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.errorTint,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.errorBorder),
        ),
        child: const Row(
          children: [
            Icon(Icons.warning_amber_rounded,
                size: 16, color: AppColors.errorText),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Attestation Gagal: Terindikasi root/jailbreak. Presensi dapat ditolak.',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.errorText,
                ),
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.successTint,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.successBorder),
      ),
      child: const Row(
        children: [
          Icon(Icons.shield_outlined, size: 16, color: AppColors.successText),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Hardware Keystore & Security Attestation Terverifikasi',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.successText,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveDeviceCard(BoundDevice current, bool compromised) {
    final String rawId =
        current.installationId.isNotEmpty ? current.installationId : current.id;
    final String displayId = rawId.length > 20
        ? '${rawId.substring(0, 10)}...${rawId.substring(rawId.length - 6)}'
        : rawId;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withOpacity(0.5)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 4,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary,
                  AppColors.primaryContainer,
                  AppColors.secondary,
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0x33BDC9C6)),
                      ),
                      child: const Icon(
                        Icons.smartphone_rounded,
                        size: 26,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            current.deviceName?.isNotEmpty == true
                                ? current.deviceName!
                                : (current.platform.isNotEmpty
                                    ? current.platform
                                    : 'Perangkat Terikat'),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${current.platform.isNotEmpty ? current.platform : 'Mobile Device'}${current.appVersion != null && current.appVersion!.isNotEmpty ? ' · v${current.appVersion}' : ''}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.inkSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Text(
                                'UUID: ',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.outline,
                                ),
                              ),
                              Flexible(
                                child: Text(
                                  displayId,
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    fontFamily: 'monospace',
                                    color: AppColors.secondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded,
                          color: AppColors.primary),
                      tooltip: 'Kirim heartbeat',
                      onPressed: () => _heartbeat(current.id),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _buildBentoGrid(current, compromised),
                const SizedBox(height: 12),
                _buildAttestationIndicator(compromised),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceHistorySection(List<BoundDevice> devices) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 8),
          child: Row(
            children: [
              const Text(
                'RIWAYAT PERANGKAT',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.3,
                  color: AppColors.outline,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(AppColors.radiusFull),
                  border: Border.all(color: AppColors.border.withOpacity(0.5)),
                ),
                child: Text(
                  '${devices.length}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.secondary,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (devices.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border.withOpacity(0.5)),
            ),
            child: const Row(
              children: [
                Icon(Icons.devices_other_rounded,
                    color: AppColors.warning, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Belum ada perangkat terdaftar. Presensi butuh minimal satu perangkat aktif.',
                    style:
                        TextStyle(fontSize: 12, color: AppColors.inkSecondary),
                  ),
                ),
              ],
            ),
          )
        else
          for (final BoundDevice d in devices) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withOpacity(0.5)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A000000),
                    blurRadius: 8,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _historyIconBg(d.status),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.smartphone_rounded,
                      size: 20,
                      color: _historyIconColor(d.status),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          d.deviceName?.isNotEmpty == true
                              ? d.deviceName!
                              : shortDeviceId(d.installationId.isEmpty
                                  ? d.id
                                  : d.installationId),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          d.registeredAt != null
                              ? '${d.platform} · ${formatIdDate(d.registeredAt!)}'
                              : d.platform,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.inkSecondary,
                          ),
                        ),
                        if (d.lastSeenAt != null) ...[
                          const SizedBox(height: 1),
                          Text(
                            'Terakhir: ${_ago(d.lastSeenAt!)}',
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.outline,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _historyStatusPill(d.status),
                ],
              ),
            ),
          ],
      ],
    );
  }

  Widget _helpdeskCard(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withOpacity(0.5)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.tealBadgeBg,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.support_agent_rounded,
              size: 22,
              color: AppColors.primaryContainer,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Kendala Perangkat Keras?',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Hubungi Helpdesk IT Ekstensi 204 atau Ruang Server Lt. 2',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.inkSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            ),
            onPressed: () => showHelpdeskSheet(context),
            child: const Text(
              'Chat IT',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<_DeviceInfo>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_DeviceInfo> snap) {
          if (!snap.hasData) {
            if (snap.hasError) {
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.warningTint,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.warningBorder),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.warning_amber_rounded,
                        color: AppColors.warningText, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Gagal memuat status perangkat. Periksa koneksi internet Anda.',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.warningText),
                      ),
                    ),
                  ],
                ),
              );
            }
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: CircularProgressIndicator(
                  color: AppColors.primary,
                ),
              ),
            );
          }
          final _DeviceInfo info = snap.data!;
          final BoundDevice? current = info.devices
              .cast<BoundDevice?>()
              .firstWhere(
                (BoundDevice? d) => d?.id == info.currentId,
                orElse: () => info.devices.isEmpty ? null : info.devices.first,
              );

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (info.compromised)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.errorTint,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.errorBorder),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.gpp_bad_rounded,
                          color: AppColors.errorText, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Perangkat Tidak Aman',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.errorText,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Perangkat ini terindikasi root/jailbreak. Server bisa menolak presensi karena alasan ini.',
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.errorText),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              _buildPolicyCard(),
              if (current != null) ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        current.status == DeviceStatus.active
                            ? 'PERANGKAT UTAMA TERIKAT'
                            : 'PERANGKAT TERIKAT',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: AppColors.outline,
                        ),
                      ),
                      _pulseStatusPill(current.status),
                    ],
                  ),
                ),
                _buildActiveDeviceCard(current, info.compromised),
              ],
              _buildDeviceHistorySection(info.devices),
              _helpdeskCard(context),
            ],
          );
        },
      );
}

class _DeviceInfo {
  _DeviceInfo({
    required this.devices,
    required this.compromised,
    required this.currentId,
  });

  final List<BoundDevice> devices;
  final bool compromised;
  final String? currentId;
}
