import 'package:flutter/material.dart';
import 'package:face_absen_mobile/core/theme/app_colors.dart';

import '../data/preflight_repository.dart';
import '../domain/eligibility.dart';

String initials(String name) {
  final List<String> parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return '?';
  if (parts.length == 1) return parts.first[0].toUpperCase();
  return (parts.first[0] + parts[1][0]).toUpperCase();
}

Widget identityCard(PreflightSnapshot s) {
  final String initialsText = initials(s.displayName);
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
      border: Border.all(color: AppColors.border.withOpacity(0.5)),
      boxShadow: [
        BoxShadow(
          color: AppColors.ink.withOpacity(0.04),
          blurRadius: 8,
          offset: const Offset(0, 2),
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
          child: Container(color: AppColors.primary),
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
                          color: AppColors.surfaceHigh,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.border.withOpacity(0.4),
                          ),
                        ),
                        child: Center(
                          child: Text(
                            initialsText,
                            style: const TextStyle(
                              color: AppColors.primary,
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
                            color: AppColors.success,
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
                                  color: AppColors.ink,
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
                                    ? AppColors.primary.withOpacity(0.1)
                                    : AppColors.roseTint,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: active
                                      ? AppColors.primary.withOpacity(0.25)
                                      : AppColors.errorBorder,
                                ),
                              ),
                              child: Text(
                                active ? 'Aktif' : 'Nonaktif',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: active
                                      ? AppColors.primary
                                      : AppColors.roseText,
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
                            color: AppColors.inkSecondary,
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
                  color: AppColors.canvas,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppColors.border.withOpacity(0.35),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.schedule,
                      size: 15,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        '$shiftName ($shiftWindow)',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(
                      Icons.local_hospital,
                      size: 14,
                      color: AppColors.inkSecondary,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        ward,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.inkSecondary,
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

Widget gateCard(GateResult g, PreflightSnapshot s) {
  return switch (g.id) {
    GateId.account => deviceGateCard(g, s),
    GateId.schedule => scheduleGateCard(g, s),
  };
}

Widget deviceGateCard(GateResult g, PreflightSnapshot s) {
  final (Color fg, Color bg, IconData icon) = switch (g.state) {
    GateState.pass => (
        AppColors.successText,
        AppColors.successTint,
        Icons.check_circle
      ),
    GateState.warn => (
        AppColors.warningText,
        AppColors.warningTint,
        Icons.error_outline
      ),
    GateState.fail => (AppColors.roseText, AppColors.roseTint, Icons.cancel),
  };
  final Color borderCol = switch (g.state) {
    GateState.pass => AppColors.successBorder,
    GateState.warn => AppColors.warningBorder,
    GateState.fail => AppColors.errorBorder,
  };

  return Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.border.withOpacity(0.5)),
      boxShadow: [
        BoxShadow(
            color: AppColors.ink.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2)),
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
                      color: AppColors.ink,
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
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
                  color: AppColors.inkSecondary,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.fingerprint,
                      size: 13, color: AppColors.inkSecondary),
                  const SizedBox(width: 3),
                  const Text(
                    'IMEI Matched',
                    style: TextStyle(
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: AppColors.inkSecondary,
                    ),
                  ),
                  const Text(
                    ' • ',
                    style: TextStyle(color: AppColors.inkDisabled),
                  ),
                  Text(
                    s.isActive
                        ? 'Keamanan Knox Aktif'
                        : 'Status Perangkat Tidak Sah',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: s.isActive
                          ? AppColors.successText
                          : AppColors.roseText,
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

Widget scheduleGateCard(GateResult g, PreflightSnapshot s) {
  final (Color fg, Color bg, IconData icon) = switch (g.state) {
    GateState.pass => (
        AppColors.successText,
        AppColors.successTint,
        Icons.check_circle
      ),
    GateState.warn => (
        AppColors.warningText,
        AppColors.warningTint,
        Icons.error_outline
      ),
    GateState.fail => (AppColors.roseText, AppColors.roseTint, Icons.cancel),
  };
  final Color borderCol = switch (g.state) {
    GateState.pass => AppColors.successBorder,
    GateState.warn => AppColors.warningBorder,
    GateState.fail => AppColors.errorBorder,
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
      border: Border.all(color: AppColors.border.withOpacity(0.5)),
      boxShadow: [
        BoxShadow(
            color: AppColors.ink.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2)),
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
                      color: AppColors.ink,
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
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
                        fontSize: 12, color: AppColors.inkSecondary),
                    children: [
                      TextSpan(text: '$shiftName Sesuai Roster '),
                      TextSpan(
                        text: '($shiftWindow)',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink,
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
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.inkSecondary),
                ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.canvas,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: AppColors.border.withOpacity(0.35),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.pin_drop,
                      size: 13,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        ward,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: AppColors.inkSecondary,
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

Widget readinessBanner(bool ready, List<GateResult> blocking) {
  return Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: ready ? AppColors.successTint : AppColors.warningTint,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(
        color: ready ? AppColors.successBorder : AppColors.warningBorder,
      ),
    ),
    child: Row(
      children: [
        Icon(
          ready ? Icons.check_circle : Icons.info_outline,
          color: ready ? AppColors.successText : AppColors.warningText,
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
                  color: ready ? AppColors.successText : AppColors.warningText,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                ready
                    ? 'Semua parameter terpenuhi. Lanjutkan ke verifikasi wajah.'
                    : 'Selesaikan parameter yang ditandai sebelum melanjutkan.',
                style: TextStyle(
                  fontSize: 11.5,
                  color: ready ? AppColors.successText : AppColors.warningText,
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
