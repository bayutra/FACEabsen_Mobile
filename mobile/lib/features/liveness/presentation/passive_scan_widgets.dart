import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

Widget header(BuildContext context, String displayName, double progress) =>
    Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        color: AppColors.inverseSurface,
        border: Border(
          bottom: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
      ),
      child: Row(
        children: <Widget>[
          InkWell(
            onTap: () => Navigator.of(context).maybePop(),
            borderRadius: BorderRadius.circular(AppColors.radiusFull),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child:
                  const Icon(Icons.arrow_back, color: Colors.white, size: 20),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text(
                  'Verifikasi Kehadiran',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
                Text(
                  '$displayName · Presensi Wajah',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.primaryFixed,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.primaryContainer.withOpacity(0.85),
              borderRadius: BorderRadius.circular(AppColors.radiusFull),
              border:
                  Border.all(color: AppColors.primaryFixed.withOpacity(0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryFixed,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 7),
                Text(
                  'Liveness\n${(progress * 100).round()}%',
                  textAlign: TextAlign.left,
                  style: const TextStyle(
                    color: AppColors.onPrimaryContainer,
                    fontSize: 10.5,
                    height: 1.25,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

Widget progressBar(double progress) => Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              const Expanded(
                child: Row(
                  children: <Widget>[
                    Icon(Icons.verified_user_outlined,
                        size: 16, color: AppColors.primaryFixed),
                    SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        'Verifikasi Wajah (Liveness)',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.surfaceHigh,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Progres: ${(progress * 100).round()}%',
                style: const TextStyle(
                  color: AppColors.primaryFixed,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppColors.radiusFull),
            child: Container(
              height: 5,
              color: Colors.white.withOpacity(0.15),
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: progress.clamp(0.04, 1.0),
                  child: Container(color: AppColors.primaryFixed),
                ),
              ),
            ),
          ),
        ],
      ),
    );

Widget instructionCard({
  required bool passed,
  required String? error,
  required String countdown,
  required String statusTitle,
  required String statusBody,
}) =>
    Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppColors.radiusCard),
        border: const Border(
          left: BorderSide(color: AppColors.primary, width: 4),
        ),
        boxShadow: AppColors.shadow2,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              passed
                  ? Icons.verified_user
                  : (error != null
                      ? Icons.error_outline
                      : Icons.visibility_outlined),
              color: AppColors.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const Expanded(
                      child: Text(
                        'VERIFIKASI WAJAH AKTIF',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceHigh,
                        borderRadius:
                            BorderRadius.circular(AppColors.radiusFull),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          const Icon(Icons.timer_outlined,
                              size: 12, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            '$countdown dtk',
                            style: const TextStyle(
                              color: AppColors.onSecondaryFixed,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              fontFeatures: <FontFeature>[
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  statusTitle,
                  style: const TextStyle(
                    color: AppColors.ink,
                    fontSize: 15,
                    height: 1.3,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  statusBody,
                  style: const TextStyle(
                    color: AppColors.inkSecondary,
                    fontSize: 11.5,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

Widget scanViewport({
  required CameraController? controller,
  required bool passed,
  required String? error,
  required double progress,
  required int faceCount,
}) =>
    Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: AspectRatio(
          aspectRatio: 0.82,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.ink,
              borderRadius: BorderRadius.circular(AppColors.radiusViewport),
              border: Border.all(
                color: (passed ? AppColors.success : AppColors.primaryFixed)
                    .withOpacity(0.45),
                width: 2,
              ),
              boxShadow: AppColors.shadow3,
            ),
            clipBehavior: Clip.antiAlias,
            child: controller == null
                ? Center(
                    child: error != null
                        ? Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              error,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 13),
                            ),
                          )
                        : const CircularProgressIndicator(
                            color: AppColors.primaryFixed),
                  )
                : Stack(
                    fit: StackFit.expand,
                    children: <Widget>[
                      FittedBox(
                        fit: BoxFit.cover,
                        child: SizedBox(
                          width: controller.value.previewSize?.height ?? 1,
                          height: controller.value.previewSize?.width ?? 1,
                          child: CameraPreview(controller),
                        ),
                      ),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: <Color>[
                              AppColors.inverseSurface.withOpacity(0.55),
                              Colors.transparent,
                              AppColors.inverseSurface.withOpacity(0.7),
                            ],
                            stops: const <double>[0, 0.4, 1],
                          ),
                        ),
                      ),
                      CustomPaint(
                        painter: FaceHudPainter(
                          progress: passed ? 1 : progress,
                          passed: passed,
                        ),
                      ),
                      if (passed)
                        const Center(
                          child: Icon(Icons.check_circle,
                              color: AppColors.success, size: 72),
                        ),
                      Align(
                        alignment: Alignment.topCenter,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: hudPill(
                            dotColor: faceCount == 1
                                ? AppColors.success
                                : AppColors.primaryFixed,
                            icon: Icons.center_focus_strong,
                            label: passed
                                ? 'Wajah Terverifikasi'
                                : (faceCount == 1
                                    ? 'Pelacakan Wajah Aktif'
                                    : (faceCount > 1
                                        ? 'Wajah Lebih dari Satu'
                                        : 'Mencari Wajah')),
                          ),
                        ),
                      ),
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color:
                                  AppColors.primaryContainer.withOpacity(0.9),
                              borderRadius:
                                  BorderRadius.circular(AppColors.radiusFull),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                Icon(
                                  passed ? Icons.verified : Icons.straighten,
                                  size: 13,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  passed
                                      ? 'Liveness Lolos'
                                      : 'Jaga Posisi Tegak Lurus',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );

Widget hudPill({
  required Color dotColor,
  required IconData icon,
  required String label,
}) =>
    Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.inverseSurface.withOpacity(0.85),
        borderRadius: BorderRadius.circular(AppColors.radiusFull),
        border: Border.all(color: AppColors.primaryFixed.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Icon(icon, size: 12, color: AppColors.onInverseSurface),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );

Widget telemetry({
  required double progress,
  required int faceCount,
  required double relativeFaceWidth,
}) {
  final bool detected = faceCount == 1;
  final bool idealDistance = relativeFaceWidth >= 0.22;
  return Container(
    padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 12),
    decoration: BoxDecoration(
      color: AppColors.inverseSurface.withOpacity(0.85),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Colors.white.withOpacity(0.18)),
    ),
    child: Row(
      children: <Widget>[
        Expanded(
          child: telemetryColumn(
            title: 'WAJAH',
            value:
                detected ? 'Optimal' : (faceCount > 1 ? 'Ganda' : 'Posisikan'),
            ok: detected,
          ),
        ),
        telemetryDivider(),
        Expanded(
          child: telemetryColumn(
            title: 'JARAK',
            value: !detected
                ? 'Menyesuaikan'
                : (idealDistance ? 'Ideal' : 'Dekatkan'),
            ok: detected && idealDistance,
          ),
        ),
        telemetryDivider(),
        Expanded(
          child: telemetryColumn(
            title: 'LIVENESS',
            value: '${(progress * 100).round()}% (Tinggi)',
            ok: progress > 0,
            icon: Icons.verified_user,
          ),
        ),
      ],
    ),
  );
}

Widget telemetryDivider() =>
    Container(width: 1, height: 26, color: Colors.white.withOpacity(0.15));

Widget telemetryColumn({
  required String title,
  required String value,
  required bool ok,
  IconData? icon,
}) {
  return Column(
    children: <Widget>[
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 12, color: AppColors.primaryFixed),
            const SizedBox(width: 4),
          ] else ...<Widget>[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: ok ? AppColors.primaryFixed : Colors.orangeAccent,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: Colors.white.withOpacity(0.6),
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: 2),
      Text(
        value,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: ok ? AppColors.primaryFixed : Colors.white70,
        ),
      ),
    ],
  );
}

Widget errorCard(String error) => Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.errorTint.withOpacity(0.14),
        borderRadius: BorderRadius.circular(AppColors.radiusCardSmall),
        border: Border.all(color: AppColors.error.withOpacity(0.7)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(Icons.error_outline, size: 18, color: AppColors.errorTint),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              error,
              style: const TextStyle(
                color: AppColors.onInverseSurface,
                fontSize: 12,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );

Widget footer({
  required BuildContext context,
  required bool passed,
  required String? error,
  required String displayName,
  required VoidCallback onRetry,
  required VoidCallback onTick,
}) =>
    Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        color: AppColors.inverseSurface,
        border: Border(
          top: BorderSide(color: Colors.white.withOpacity(0.12)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          SizedBox(
            width: double.infinity,
            height: AppColors.buttonHeight,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primaryContainer,
                foregroundColor: Colors.white,
                disabledBackgroundColor:
                    AppColors.primaryContainer.withOpacity(0.6),
                disabledForegroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppColors.radiusButton),
                ),
              ),
              onPressed: passed ? null : (error != null ? onRetry : onTick),
              icon: Icon(
                passed
                    ? Icons.verified
                    : (error != null
                        ? Icons.refresh
                        : Icons.photo_camera_outlined),
                size: 20,
              ),
              label: Text(
                passed
                    ? 'Wajah Terverifikasi'
                    : (error != null ? 'Coba Pindai Ulang' : 'Pindai Sekarang'),
                style:
                    const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            height: AppColors.ghostHeight,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                backgroundColor: Colors.white.withOpacity(0.08),
                side: BorderSide(color: Colors.white.withOpacity(0.25)),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppColors.radiusCardSmall),
                ),
              ),
              onPressed: passed ? null : () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.close, size: 18),
              label: const Text(
                'Batalkan Presensi',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              Text(
                'Anti-spoofing aktif',
                style: TextStyle(
                    fontSize: 10, color: Colors.white.withOpacity(0.5)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'ID Karyawan: $displayName',
                  textAlign: TextAlign.right,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 10, color: Colors.white.withOpacity(0.5)),
                ),
              ),
            ],
          ),
        ],
      ),
    );

/// Clinical face guides: brackets, oval scan target, eye anchors, percentage
/// arc and a mouth reference line.

class FaceHudPainter extends CustomPainter {
  const FaceHudPainter({required this.progress, required this.passed});

  final double progress;
  final bool passed;

  @override
  void paint(Canvas canvas, Size size) {
    final Color accent = passed ? AppColors.success : AppColors.primaryFixed;
    final Rect oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.47),
      width: size.width * 0.62,
      height: size.height * 0.56,
    );

    canvas.drawOval(
      oval,
      Paint()
        ..color = accent.withOpacity(0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4,
    );

    canvas.drawArc(
      oval,
      -math.pi / 2,
      2 * math.pi * progress.clamp(0, 1),
      false,
      Paint()
        ..color = accent
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );

    final Paint eyeRing = Paint()
      ..color = AppColors.inversePrimary.withOpacity(0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    final Paint eyeDot = Paint()
      ..color = AppColors.inversePrimary
      ..style = PaintingStyle.fill;
    final Offset leftEye = Offset(size.width * 0.40, size.height * 0.43);
    final Offset rightEye = Offset(size.width * 0.60, size.height * 0.43);
    canvas.drawCircle(leftEye, 12, eyeRing);
    canvas.drawCircle(leftEye, 3.5, eyeDot);
    canvas.drawCircle(rightEye, 12, eyeRing);
    canvas.drawCircle(rightEye, 3.5, eyeDot);

    canvas.drawLine(
      Offset(size.width * 0.43, size.height * 0.64),
      Offset(size.width * 0.57, size.height * 0.64),
      Paint()
        ..color = accent.withOpacity(0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    final Paint bracket = Paint()
      ..color = accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round;
    const double length = 20;
    const double pad = 12;
    final double right = size.width - pad;
    final double bottom = size.height - pad;
    for (final (Offset start, Offset end) in <(Offset, Offset)>[
      (const Offset(pad, pad), const Offset(pad + length, pad)),
      (const Offset(pad, pad), const Offset(pad, pad + length)),
      (Offset(right, pad), Offset(right - length, pad)),
      (Offset(right, pad), Offset(right, pad + length)),
      (Offset(pad, bottom), Offset(pad + length, bottom)),
      (Offset(pad, bottom), Offset(pad, bottom - length)),
      (Offset(right, bottom), Offset(right - length, bottom)),
      (Offset(right, bottom), Offset(right, bottom - length)),
    ]) {
      canvas.drawLine(start, end, bracket);
    }
  }

  @override
  bool shouldRepaint(covariant FaceHudPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.passed != passed;
}
