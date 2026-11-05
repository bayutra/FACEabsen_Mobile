import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../data/profile_repository.dart';

String initials(String name) {
  final List<String> parts =
      name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
}

Widget sectionHeader(String title) {
  return Padding(
    padding: const EdgeInsets.only(left: 4, bottom: 8, top: 4),
    child: Text(
      title.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.outline,
        letterSpacing: 1.2,
      ),
    ),
  );
}

Widget pill({
  required Color bg,
  required Color border,
  required Color text,
  required String label,
  IconData? icon,
}) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(AppColors.radiusFull),
      border: Border.all(color: border),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 12, color: text),
          const SizedBox(width: 4),
        ],
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: text,
            letterSpacing: 0.2,
          ),
        ),
      ],
    ),
  );
}

Widget identityCard(ProfileSnapshot d) => Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withOpacity(0.4)),
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 5,
            color: AppColors.primaryContainer,
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Stack(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceLow,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppColors.inversePrimary,
                              width: 2,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              initials(d.name),
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                                fontSize: 22,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.ink.withOpacity(0.12),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.verified_rounded,
                              size: 16,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              pill(
                                bg: d.isActive
                                    ? AppColors.successTint
                                    : AppColors.roseTint,
                                border: d.isActive
                                    ? AppColors.successBorder
                                    : AppColors.errorBorder,
                                text: d.isActive
                                    ? AppColors.successText
                                    : AppColors.error,
                                label:
                                    d.isActive ? 'PNS / ASN Aktif' : 'Nonaktif',
                                icon: d.isActive
                                    ? Icons.check_circle_rounded
                                    : Icons.cancel_rounded,
                              ),
                              for (final String r in d.roles)
                                pill(
                                  bg: AppColors.surfaceLow,
                                  border: AppColors.border,
                                  text: AppColors.primary,
                                  label: r,
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            d.name,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            d.position.isNotEmpty
                                ? d.position
                                : 'Staf Medis SIMRS',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'NIP: ${d.employeeNo}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontFamily: 'monospace',
                              color: AppColors.inkSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.only(top: 12),
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(color: AppColors.surfaceLow),
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.local_hospital_outlined,
                            size: 16,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              d.department.isNotEmpty
                                  ? d.department
                                  : 'RSU Darmayu Madiun',
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: AppColors.inkSecondary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(
                            Icons.mail_outline_rounded,
                            size: 16,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              d.email,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: AppColors.inkSecondary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Container(
                  margin: const EdgeInsets.only(top: 14),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: AppColors.border.withOpacity(0.25)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.ink.withOpacity(0.03),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.fact_check_outlined,
                          size: 18,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Status Akun SIMRS',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: AppColors.inkSecondary,
                              ),
                            ),
                            Text(
                              d.isActive
                                  ? 'Terverifikasi & Aktif'
                                  : 'Akun Ditangguhkan',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius:
                              BorderRadius.circular(AppColors.radiusFull),
                          border: Border.all(
                            color: d.faceRegistered
                                ? AppColors.inversePrimary
                                : AppColors.errorBorder,
                          ),
                        ),
                        child: Text(
                          d.faceRegistered ? 'Biometrik Siap' : 'Perlu Foto',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: d.faceRegistered
                                ? AppColors.primary
                                : AppColors.error,
                          ),
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

Widget securityCard(ProfileSnapshot d, {required VoidCallback onRegisterFace}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      sectionHeader('KEAMANAN & VERIFIKASI BIOMETRIK'),
      Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border.withOpacity(0.4)),
          boxShadow: [
            BoxShadow(
              color: AppColors.ink.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            securityTile(
              icon: Icons.face_retouching_natural,
              iconColor: AppColors.primary,
              iconBg: AppColors.primary.withOpacity(0.10),
              title: 'Verifikasi Biometrik Wajah',
              subtitle: d.faceRegistered
                  ? 'Data wajah tersimpan${d.faceVersion != null ? ' · v${d.faceVersion}' : ''}'
                  : 'Wajah belum terdaftar di SIMRS',
              trailing: pill(
                bg: d.faceRegistered
                    ? AppColors.successTint
                    : AppColors.roseTint,
                border: d.faceRegistered
                    ? AppColors.successBorder
                    : AppColors.errorBorder,
                text:
                    d.faceRegistered ? AppColors.successText : AppColors.error,
                label: d.faceRegistered ? 'Terdaftar' : 'Belum Ada',
                icon: d.faceRegistered ? Icons.check : Icons.close,
              ),
            ),
            const Divider(height: 1, thickness: 1, color: AppColors.surfaceLow),
            securityTile(
              icon: Icons.privacy_tip_outlined,
              iconColor: AppColors.secondary,
              iconBg: AppColors.secondary.withOpacity(0.10),
              title: 'Persetujuan Biometrik',
              subtitle: d.biometricConsent
                  ? 'Kerahasiaan data & consent disetujui'
                  : 'Persetujuan belum diberikan / dicabut',
              trailing: pill(
                bg: d.biometricConsent
                    ? AppColors.successTint
                    : AppColors.warningTint,
                border: d.biometricConsent
                    ? AppColors.successBorder
                    : AppColors.warningBorder,
                text: d.biometricConsent
                    ? AppColors.successText
                    : AppColors.warningText,
                label: d.biometricConsent ? 'Disetujui' : 'Belum',
                icon: d.biometricConsent
                    ? Icons.check
                    : Icons.warning_amber_rounded,
              ),
            ),
            const Divider(height: 1, thickness: 1, color: AppColors.surfaceLow),
            securityTile(
              icon: Icons.devices_other_outlined,
              iconColor: AppColors.primary,
              iconBg: AppColors.primary.withOpacity(0.10),
              title: 'Perangkat Terdaftar',
              subtitle:
                  '${d.activeDevices} perangkat aktif dari ${d.totalDevices}',
              trailing: pill(
                bg: d.activeDevices > 0
                    ? AppColors.successTint
                    : AppColors.roseTint,
                border: d.activeDevices > 0
                    ? AppColors.successBorder
                    : AppColors.errorBorder,
                text: d.activeDevices > 0
                    ? AppColors.successText
                    : AppColors.error,
                label: '${d.activeDevices} Aktif',
              ),
            ),
            if (!d.faceRegistered) ...[
              const Divider(
                height: 1,
                thickness: 1,
                color: AppColors.surfaceLow,
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.roseTint,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.errorBorder),
                      ),
                      child: const Row(
                        children: [
                          Icon(
                            Icons.warning_amber_rounded,
                            color: AppColors.error,
                            size: 20,
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Wajah belum terdaftar. Presensi dinas tidak akan bisa diverifikasi.',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.roseText,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton.icon(
                        onPressed: onRegisterFace,
                        icon: const Icon(Icons.camera_alt_outlined, size: 18),
                        label: const Text(
                          'Daftarkan Wajah Sekarang',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    ],
  );
}

Widget securityTile({
  required IconData icon,
  required Color iconColor,
  required Color iconBg,
  required String title,
  required String subtitle,
  required Widget trailing,
}) {
  return Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    child: Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.inkSecondary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        trailing,
      ],
    ),
  );
}
