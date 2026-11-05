// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';

import '../data/device_repository.dart';
import '../domain/device_models.dart';
import 'device_cards.dart';
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
              policyCard(
                employeeName: widget.employeeName,
                employeeNip: widget.employeeNip,
                unit: widget.unit,
              ),
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
                      pulseStatusPill(current.status),
                    ],
                  ),
                ),
                activeDeviceCard(current, info.compromised,
                    onHeartbeat: _heartbeat),
              ],
              deviceHistorySection(info.devices),
              helpdeskCard(context),
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
