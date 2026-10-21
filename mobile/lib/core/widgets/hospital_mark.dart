import 'package:flutter/material.dart';

/// Logo aplikasi Darmayu Face ID.
///
/// Sumber asli ada di `assets/logo/favicon.png`; versi yang dipakai aplikasi
/// (`assets/logo/app_logo.png`) sudah dirapikan agar sudutnya penuh.
class HospitalMark extends StatelessWidget {
  const HospitalMark({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.22),
        child: Image.asset(
          'assets/logo/app_logo.png',
          width: size,
          height: size,
          fit: BoxFit.cover,
          filterQuality: FilterQuality.high,
        ),
      );
}
