import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Brand RSU Darmayu Madiun: kotak teal + palang putih + garis nadi.
/// Satu-satunya logo aplikasi — dipakai di login, header hasil, dsb.
/// Digambar vektor agar tajam di semua ukuran tanpa aset gambar.
class HospitalMark extends StatelessWidget {
  const HospitalMark({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _HospitalMarkPainter()),
      );
}

class _HospitalMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double s = size.width;
    final Paint teal = Paint()..color = AppColors.primaryContainer;
    final Paint white = Paint()..color = Colors.white;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(0, 0, s, s),
        Radius.circular(s * 0.22),
      ),
      teal,
    );

    // Palang putih.
    final double cx = s / 2;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(cx, s * 0.5), width: s * 0.16, height: s * 0.5),
        Radius.circular(s * 0.03),
      ),
      white,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(cx, s * 0.5), width: s * 0.5, height: s * 0.16),
        Radius.circular(s * 0.03),
      ),
      white,
    );

    // Garis nadi teal di atas palang.
    final Paint pulse = Paint()
      ..color = AppColors.primaryContainer
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.055
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final Path path = Path()
      ..moveTo(s * 0.31, s * 0.5)
      ..lineTo(s * 0.41, s * 0.5)
      ..lineTo(s * 0.45, s * 0.38)
      ..lineTo(s * 0.52, s * 0.62)
      ..lineTo(s * 0.56, s * 0.5)
      ..lineTo(s * 0.69, s * 0.5);
    canvas.drawPath(path, pulse);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
