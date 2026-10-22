import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF005C55);
  static const Color primaryContainer = Color(0xFF0F766E);
  static const Color primaryFixed = Color(0xFF9CF2E8);
  static const Color onPrimaryFixed = Color(0xFF00201D);
  static const Color onPrimaryContainer = Color(0xFFA3FAE8);
  static const Color inversePrimary = Color(0xFF80D5CB);

  static const Color secondary = Color(0xFF006591);

  static const Color interactive = Color(0xFF0EA5E9);
  static const Color secondaryContainer = Color(0xFF39B8FD);
  static const Color secondaryFixed = Color(0xFFC9E6FF);
  static const Color secondaryFixedDim = Color(0xFF89CEFF);
  static const Color onSecondaryFixed = Color(0xFF001E2F);
  static const Color onSecondaryContainer = Color(0xFF004666);

  static const Color tertiary = Color(0xFF005C54);
  static const Color tertiaryContainer = Color(0xFF00776D);

  static const Color canvas = Color(0xFFF8F9FF);
  static const Color surface = Color(0xFFF8F9FF);
  static const Color surfaceLowest = Color(0xFFFFFFFF);
  static const Color surfaceLow = Color(0xFFEFF4FF);
  static const Color surfaceContainer = Color(0xFFE5EEFF);
  static const Color surfaceHigh = Color(0xFFDCE9FF);
  static const Color surfaceHighest = Color(0xFFD3E4FE);
  static const Color surfaceVariant = Color(0xFFD3E4FE);

  static const Color card = surfaceLowest;
  static const Color outline = Color(0xFF6E7977);
  static const Color border = Color(0xFFBDC9C6);
  static const Color inputBorder = Color(0xFFCBD5E1);
  static const Color divider = Color(0xFFE2E8F0);
  static const Color dividerSoft = Color(0xFFF1F5F9);
  static const Color borderStrong = Color(0xFF6E7977);
  static const Color hairline = Color(0xFFEFF4FF);

  static const Color ink = Color(0xFF0B1C30);
  static const Color inkSecondary = Color(0xFF3E4947);
  static const Color onSurfaceVariant = Color(0xFF3E4947);
  static const Color inkDisabled = Color(0xFF94A3B8);
  static const Color inverseSurface = Color(0xFF213145);
  static const Color onInverseSurface = Color(0xFFEAF1FF);

  static const Color success = Color(0xFF10B981);
  static const Color successTint = Color(0xFFECFDF5);
  static const Color successText = Color(0xFF047857);
  static const Color successBorder = Color(0xFFA7F3D0);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningTint = Color(0xFFFFFBEB);
  static const Color warningText = Color(0xFFB45309);
  static const Color warningBorder = Color(0xFFFDE68A);

  static const Color error = Color(0xFFBA1A1A);
  static const Color errorTint = Color(0xFFFFDAD6);
  static const Color errorText = Color(0xFF93000A);
  static const Color errorBorder = Color(0xFFFECACA);

  static const Color info = Color(0xFF0284C7);
  static const Color infoTint = Color(0xFFF0F9FF);
  static const Color infoBorder = Color(0xFFBAE6FD);

  static const Color roseTint = Color(0xFFFEF2F2);
  static const Color roseText = Color(0xFFB91C1C);
  static const Color roseTextDark = Color(0xFF991B1B);
  static const Color roseBorder = Color(0xFFFECACA);
  static const Color roseFill = Color(0xFFEF4444);

  static const Color scanner = Color(0xFF0EA5E9);

  static const Color tealBadgeBg = Color(0xFFCCFBF1);
  static const Color tealBadgeText = Color(0xFF0F766E);
  static const Color tealBadgeBorder = Color(0xFF99F6E4);

  static const double radiusInput = 12;
  static const double radiusButton = 16;
  static const double radiusCard = 16;
  static const double radiusCardSmall = 12.0;
  static const double radiusHero = 24;
  static const double radiusSheet = 28;
  static const double radiusViewport = 32;
  static const double radiusFull = 9999;

  static const double touchTarget = 48;
  static const double buttonHeight = 52;
  static const double ghostHeight = 48;
  static const double inputHeight = 48;
  static const double pageMargin = 16;
  static const double headerPy = 8;

  static const Color primaryActive = Color(0xFF0D9488);
  static const double pressScale = 0.98;

  static const List<BoxShadow> shadow1 = <BoxShadow>[
    BoxShadow(color: Color(0x0D0F172A), blurRadius: 3, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x080F172A), blurRadius: 2, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> shadow2 = <BoxShadow>[
    BoxShadow(color: Color(0x120F172A), blurRadius: 6, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x0A0F172A), blurRadius: 4, offset: Offset(0, 2)),
  ];

  static const List<BoxShadow> shadow3 = <BoxShadow>[
    BoxShadow(color: Color(0x1A0F172A), blurRadius: 25, offset: Offset(0, 20)),
    BoxShadow(color: Color(0x0D0F172A), blurRadius: 10, offset: Offset(0, 8)),
  ];
}

class AppText {
  AppText._();

  static const String family = 'Inter';

  static const List<FontFeature> _tabular = <FontFeature>[
    FontFeature.tabularFigures(),
  ];

  static const TextStyle displayLg = TextStyle(
    fontSize: 36,
    height: 44 / 36,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.72,
  );

  static const TextStyle displayMobile = TextStyle(
    fontSize: 28,
    height: 36 / 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.56,
  );

  static const TextStyle headlineLg = TextStyle(
    fontSize: 24,
    height: 32 / 24,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.36,
  );

  static const TextStyle headlineMd = TextStyle(
    fontSize: 20,
    height: 28 / 20,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.20,
  );

  static const TextStyle headlineSm = TextStyle(
    fontSize: 18,
    height: 24 / 18,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle bodyLg = TextStyle(fontSize: 16, height: 24 / 16);
  static const TextStyle bodyLgMedium = TextStyle(
    fontSize: 16,
    height: 24 / 16,
    fontWeight: FontWeight.w500,
  );
  static const TextStyle bodyMd = TextStyle(fontSize: 14, height: 20 / 14);
  static const TextStyle bodyMdMedium = TextStyle(
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w500,
  );
  static const TextStyle labelMd = TextStyle(
    fontSize: 12,
    height: 16 / 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.24,
  );
  static const TextStyle labelSm = TextStyle(
    fontSize: 11,
    height: 14 / 11,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.11,
  );

  static const TextStyle metric = TextStyle(
    fontSize: 32,
    height: 36 / 32,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.64,
    fontFeatures: _tabular,
  );

  static TextStyle metricSmall({double size = 14}) => TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w600,
        fontFeatures: _tabular,
      );

  static TextTheme textTheme(Color ink, Color inkSecondary) => TextTheme(
        displayLarge: displayLg.copyWith(color: ink),
        displayMedium: displayMobile.copyWith(color: ink),
        headlineLarge: headlineLg.copyWith(color: ink),
        headlineMedium: headlineMd.copyWith(color: ink),
        headlineSmall: headlineSm.copyWith(color: ink),
        bodyLarge: bodyLg.copyWith(color: ink),
        bodyMedium: bodyMd.copyWith(color: ink),
        bodySmall: labelSm.copyWith(color: inkSecondary),
        labelLarge: labelMd.copyWith(color: ink),
        labelMedium: labelMd.copyWith(color: inkSecondary),
        labelSmall: labelSm.copyWith(color: inkSecondary),
      );
}
