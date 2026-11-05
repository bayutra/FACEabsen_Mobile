import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

Widget livenessViewport({
  required CameraController? controller,
  required String? error,
  required int faceCount,
  required bool flashOn,
  required VoidCallback onToggleFlash,
  required Animation<double> scan,
}) =>
    Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: AspectRatio(
          aspectRatio: 0.8,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.ink,
              borderRadius: BorderRadius.circular(32),
              border: Border.all(
                  color: AppColors.primaryFixed.withOpacity(0.4), width: 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.4),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: error != null && controller == null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        error,
                        textAlign: TextAlign.center,
                        style:
                            const TextStyle(color: Colors.white, fontSize: 13),
                      ),
                    ),
                  )
                : controller == null
                    ? const Center(
                        child: CircularProgressIndicator(
                            color: AppColors.primaryFixed))
                    : Stack(
                        fit: StackFit.expand,
                        children: [
                          CameraPreview(controller),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  AppColors.inverseSurface.withOpacity(0.6),
                                  Colors.transparent,
                                  AppColors.inverseSurface.withOpacity(0.75),
                                ],
                              ),
                            ),
                          ),
                          const CustomPaint(painter: BiometricHudPainter()),
                          Positioned.fill(
                            child: IgnorePointer(
                              child: AnimatedBuilder(
                                animation: scan,
                                builder: (BuildContext context, Widget? child) {
                                  final double t =
                                      Curves.easeInOut.transform(scan.value);
                                  return Align(
                                    alignment: Alignment(0, -1 + 2 * t),
                                    child: Container(
                                      height: 2,
                                      margin: const EdgeInsets.symmetric(
                                        horizontal: 26,
                                      ),
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [
                                            Colors.transparent,
                                            AppColors.primaryFixed
                                                .withOpacity(0.9),
                                            Colors.transparent,
                                          ],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppColors.primaryFixed
                                                .withOpacity(0.45),
                                            blurRadius: 8,
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.topRight,
                            child: Padding(
                              padding: const EdgeInsets.only(top: 8, right: 8),
                              child: Tooltip(
                                message: flashOn
                                    ? 'Matikan lampu kilat'
                                    : 'Nyalakan lampu kilat',
                                child: Material(
                                  color: flashOn
                                      ? AppColors.primaryFixed
                                      : Colors.black.withOpacity(0.45),
                                  shape: const CircleBorder(),
                                  child: InkWell(
                                    customBorder: const CircleBorder(),
                                    onTap: onToggleFlash,
                                    child: Padding(
                                      padding: const EdgeInsets.all(8),
                                      child: Icon(
                                        flashOn
                                            ? Icons.flash_on
                                            : Icons.flash_off,
                                        size: 18,
                                        color: flashOn
                                            ? AppColors.inverseSurface
                                            : Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.topCenter,
                            child: Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.inverseSurface
                                      .withOpacity(0.85),
                                  borderRadius: BorderRadius.circular(
                                      AppColors.radiusFull),
                                  border: Border.all(
                                      color: AppColors.primaryFixed
                                          .withOpacity(0.4)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    CircleAvatar(
                                      radius: 3,
                                      backgroundColor: faceCount == 1
                                          ? AppColors.success
                                          : AppColors.primaryFixed,
                                    ),
                                    const SizedBox(width: 5),
                                    Text(
                                      faceCount == 1
                                          ? 'Wajah Terdeteksi'
                                          : 'Mencari Wajah...',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.bottomCenter,
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryContainer
                                      .withOpacity(0.9),
                                  borderRadius: BorderRadius.circular(
                                      AppColors.radiusFull),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      faceCount == 1
                                          ? Icons.center_focus_strong
                                          : Icons.face_retouching_natural,
                                      size: 13,
                                      color: Colors.white,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      faceCount == 1
                                          ? 'Tahan Posisi'
                                          : 'Posisikan Wajah di Tengah',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
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

Widget signalTiles({
  required double progress,
  required int faceCount,
  required double relativeFaceWidth,
}) {
  final bool detected = faceCount == 1;
  final bool closeEnough = relativeFaceWidth >= 0.25;
  return Container(
    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
    decoration: BoxDecoration(
      color: AppColors.inverseSurface.withOpacity(0.85),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Colors.white.withOpacity(0.18)),
    ),
    child: Row(
      children: [
        Expanded(
          child: telemetryColumn(
            title: 'WAJAH',
            value:
                detected ? 'Optimal' : (faceCount > 1 ? 'Ramai' : 'Posisikan'),
            ok: detected,
          ),
        ),
        Container(width: 1, height: 26, color: Colors.white.withOpacity(0.15)),
        Expanded(
          child: telemetryColumn(
            title: 'CAHAYA',
            value: closeEnough ? 'Cukup' : (detected ? 'Dekatkan' : 'Optimal'),
            ok: true,
          ),
        ),
        Container(width: 1, height: 26, color: Colors.white.withOpacity(0.15)),
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

Widget telemetryColumn({
  required String title,
  required String value,
  required bool ok,
  IconData? icon,
}) {
  return Column(
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: AppColors.primaryFixed),
            const SizedBox(width: 4),
          ] else ...[
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
          Text(
            title,
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              color: Colors.white.withOpacity(0.6),
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
      const SizedBox(height: 2),
      Text(
        value,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: ok ? AppColors.primaryFixed : Colors.white70,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    ],
  );
}

class BiometricHudPainter extends CustomPainter {
  const BiometricHudPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final Rect oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.48),
      width: size.width * 0.56,
      height: size.height * 0.60,
    );
    final Paint ovalPaint = Paint()
      ..color = AppColors.primaryFixed.withOpacity(0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3;
    canvas.drawOval(oval, ovalPaint);

    final Paint eyePaint = Paint()
      ..color = AppColors.inversePrimary.withOpacity(0.65)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    final Paint eyeDotPaint = Paint()
      ..color = AppColors.inversePrimary
      ..style = PaintingStyle.fill;

    final Offset leftEye = Offset(size.width * 0.40, size.height * 0.44);
    final Offset rightEye = Offset(size.width * 0.60, size.height * 0.44);
    canvas.drawCircle(leftEye, 12, eyePaint);
    canvas.drawCircle(leftEye, 3.5, eyeDotPaint);
    canvas.drawCircle(rightEye, 12, eyePaint);
    canvas.drawCircle(rightEye, 3.5, eyeDotPaint);

    final Paint mouthPaint = Paint()
      ..color = AppColors.primaryFixed.withOpacity(0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    canvas.drawLine(
      Offset(size.width * 0.43, size.height * 0.66),
      Offset(size.width * 0.57, size.height * 0.66),
      mouthPaint,
    );

    final Paint bracketPaint = Paint()
      ..color = AppColors.primaryFixed
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;

    const double bracketSize = 18;
    const double pad = 12;

    canvas.drawLine(const Offset(pad, pad),
        const Offset(pad + bracketSize, pad), bracketPaint);
    canvas.drawLine(const Offset(pad, pad),
        const Offset(pad, pad + bracketSize), bracketPaint);

    canvas.drawLine(Offset(size.width - pad, pad),
        Offset(size.width - pad - bracketSize, pad), bracketPaint);
    canvas.drawLine(Offset(size.width - pad, pad),
        Offset(size.width - pad, pad + bracketSize), bracketPaint);

    canvas.drawLine(Offset(pad, size.height - pad),
        Offset(pad + bracketSize, size.height - pad), bracketPaint);
    canvas.drawLine(Offset(pad, size.height - pad),
        Offset(pad, size.height - pad - bracketSize), bracketPaint);

    canvas.drawLine(
        Offset(size.width - pad, size.height - pad),
        Offset(size.width - pad - bracketSize, size.height - pad),
        bracketPaint);
    canvas.drawLine(
        Offset(size.width - pad, size.height - pad),
        Offset(size.width - pad, size.height - pad - bracketSize),
        bracketPaint);
  }

  @override
  bool shouldRepaint(covariant BiometricHudPainter oldDelegate) => false;
}
