import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

class ProcessingView extends StatelessWidget {
  const ProcessingView({
    super.key,
    required this.step,
    required this.phase,
    required this.onCancel,
  });

  final int step;
  final String? phase;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLow,
      body: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.white,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.local_hospital,
                            color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'RS Absen',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                          Row(
                            children: [
                              CircleAvatar(
                                  radius: 3,
                                  backgroundColor: AppColors.success),
                              SizedBox(width: 4),
                              Text(
                                'SIMRS Mobile Ver. 3.4',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  color: AppColors.inkSecondary,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(AppColors.radiusFull),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.apartment,
                            size: 14, color: AppColors.primary),
                        SizedBox(width: 4),
                        Text(
                          'RSU Darmayu Madiun',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  children: [
                    SizedBox(
                      height: 180,
                      child: Center(
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 170,
                              height: 170,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.primary.withOpacity(0.2),
                                  width: 2,
                                ),
                              ),
                            ),
                            Container(
                              width: 140,
                              height: 140,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.primary.withOpacity(0.35),
                                  width: 1.5,
                                ),
                              ),
                            ),
                            Container(
                              width: 100,
                              height: 100,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.primaryContainer,
                                border: Border.all(
                                    color: AppColors.primaryFixed, width: 3),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withOpacity(0.3),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: const Center(
                                child: Icon(Icons.person,
                                    size: 56, color: Colors.white),
                              ),
                            ),
                            Positioned(
                              bottom: 35,
                              right: 35,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.face,
                                    size: 16, color: AppColors.primary),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer.withOpacity(0.12),
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusFull),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                              radius: 3.5,
                              backgroundColor: AppColors.primaryContainer),
                          SizedBox(width: 6),
                          Text(
                            'Layar Verifikasi Sedang Berlangsung',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primaryContainer,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Memverifikasi Presensi Anda...',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      phase ??
                          'Sistem sedang memproses data biometrik ke server SIMRS Kepegawaian.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.inkSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusButton),
                        border: Border.all(
                            color: AppColors.border.withOpacity(0.5)),
                      ),
                      child: Column(
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.timelapse,
                                      size: 15, color: AppColors.primary),
                                  SizedBox(width: 6),
                                  Text(
                                    'Proses Sinkronisasi',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.inkSecondary,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                'Mohon tunggu...',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.outline,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius:
                                BorderRadius.circular(AppColors.radiusFull),
                            child: const LinearProgressIndicator(
                              minHeight: 6,
                              backgroundColor: AppColors.surfaceContainer,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusButton),
                        border: Border.all(
                            color: AppColors.border.withOpacity(0.6)),
                      ),
                      child: Column(
                        children: [
                          pipelineStep(
                            stepNumber: '1',
                            title: 'Verifikasi Biometrik Wajah',
                            subtitle: step >= 1
                                ? 'Liveness Lolos'
                                : 'Menunggu hasil pindai wajah',
                            isDone: step >= 1,
                            isInProgress: step == 0,
                          ),
                          const Divider(height: 1),
                          pipelineStep(
                            stepNumber: '2',
                            title: 'Enkripsi & Keamanan Perangkat',
                            subtitle: step >= 2
                                ? 'Hardware UUID & tanda tangan terkirim'
                                : 'Menunggu giliran pengiriman',
                            isDone: step >= 2,
                            isInProgress: step == 1,
                          ),
                          const Divider(height: 1),
                          pipelineStep(
                            stepNumber: '3',
                            title: 'Validasi Jadwal Shift',
                            subtitle: step >= 3
                                ? 'Selesai'
                                : 'Memeriksa jadwal shift & status waktu',
                            isDone: step >= 3,
                            isInProgress: step == 2,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: AppColors.primary.withOpacity(0.2)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.shield_outlined,
                              size: 20, color: AppColors.primary),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Jangan tutup aplikasi saat proses enkripsi berlangsung demi keabsahan log kehadiran.',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: AppColors.inkSecondary,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: onCancel,
                      icon: const Icon(Icons.close, size: 18),
                      label: const Text(
                        'Batalkan Presensi',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget pipelineStep({
    required String stepNumber,
    required String title,
    required String subtitle,
    required bool isDone,
    required bool isInProgress,
  }) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDone
                  ? AppColors.successTint
                  : (isInProgress ? AppColors.infoTint : AppColors.surfaceLow),
              border: Border.all(
                color: isDone
                    ? AppColors.success
                    : (isInProgress ? AppColors.info : AppColors.border),
              ),
            ),
            child: Center(
              child: isDone
                  ? const Icon(Icons.check,
                      size: 15, color: AppColors.successText)
                  : (isInProgress
                      ? const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.info,
                          ),
                        )
                      : Text(
                          stepNumber,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.outline,
                          ),
                        )),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '$stepNumber. $title',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isInProgress ? AppColors.primary : AppColors.ink,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isDone
                            ? AppColors.successTint
                            : (isInProgress
                                ? AppColors.infoTint
                                : AppColors.surfaceLow),
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusFull),
                      ),
                      child: Text(
                        isDone
                            ? 'Selesai'
                            : (isInProgress ? 'Proses' : 'Menunggu'),
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                          color: isDone
                              ? AppColors.successText
                              : (isInProgress
                                  ? AppColors.info
                                  : AppColors.outline),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: isDone
                        ? AppColors.successText
                        : (isInProgress ? AppColors.info : AppColors.outline),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
