import 'package:flutter/material.dart';

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
