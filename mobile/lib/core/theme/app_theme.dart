import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';

ThemeData buildAppTheme() {
  const ColorScheme scheme = ColorScheme.light(
    primary: AppColors.primary,
    onPrimary: Colors.white,
    primaryContainer: AppColors.primaryContainer,
    onPrimaryContainer: AppColors.onPrimaryContainer,
    secondary: AppColors.secondary,
    onSecondary: Colors.white,
    secondaryContainer: AppColors.secondaryContainer,
    onSecondaryContainer: AppColors.onSecondaryContainer,
    tertiary: AppColors.tertiary,
    onTertiary: Colors.white,
    tertiaryContainer: AppColors.tertiaryContainer,
    onTertiaryContainer: AppColors.onPrimaryContainer,
    error: AppColors.error,
    onError: Colors.white,
    errorContainer: AppColors.errorTint,
    onErrorContainer: AppColors.errorText,
    surface: AppColors.surface,
    onSurface: AppColors.ink,
    surfaceContainerHighest: AppColors.surfaceHighest,
    onSurfaceVariant: AppColors.onSurfaceVariant,
    outline: AppColors.outline,
    outlineVariant: AppColors.border,
    inverseSurface: AppColors.inverseSurface,
    onInverseSurface: AppColors.onInverseSurface,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.surfaceLow,
    textTheme: AppText.textTheme(AppColors.ink, AppColors.inkSecondary),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surfaceLowest,
      foregroundColor: AppColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surfaceLowest,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      constraints: const BoxConstraints(minHeight: AppColors.inputHeight),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusInput),
        borderSide: const BorderSide(color: AppColors.inputBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusInput),
        borderSide: const BorderSide(color: AppColors.inputBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusInput),
        borderSide: const BorderSide(color: AppColors.interactive, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusInput),
        borderSide: const BorderSide(color: AppColors.roseFill),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusInput),
        borderSide: const BorderSide(color: AppColors.roseFill, width: 1.5),
      ),
      labelStyle: AppText.bodyMd.copyWith(color: AppColors.inkSecondary),
      helperStyle: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
      errorStyle: AppText.labelSm.copyWith(color: AppColors.errorText),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primaryContainer,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.surfaceContainer,
        disabledForegroundColor: AppColors.inkDisabled,
        minimumSize: const Size(64, AppColors.buttonHeight),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusButton),
        ),
        textStyle: AppText.bodyLgMedium,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        minimumSize: const Size(64, AppColors.ghostHeight),
        side: const BorderSide(color: AppColors.inputBorder, width: 1.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radiusButton),
        ),
        textStyle: AppText.bodyLgMedium,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.secondary,
        textStyle: AppText.labelMd,
      ),
    ),
    cardTheme: CardTheme(
      color: AppColors.surfaceLowest,
      elevation: 1,
      shadowColor: AppColors.ink.withOpacity(0.08),
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusCard),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.hairline,
      thickness: 1,
      space: 1,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surfaceLowest,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppColors.radiusSheet)),
      ),
    ),
    dialogTheme: DialogTheme(
      backgroundColor: AppColors.surfaceLowest,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusHero),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surfaceLowest,
      indicatorColor: AppColors.primaryContainer,
      labelTextStyle:
          WidgetStateProperty.resolveWith((Set<WidgetState> states) {
        if (states.contains(WidgetState.selected)) {
          return AppText.labelSm.copyWith(
            color: AppColors.ink,
            fontWeight: FontWeight.w700,
          );
        }
        return AppText.labelSm.copyWith(color: AppColors.inkSecondary);
      }),
      iconTheme: WidgetStateProperty.resolveWith((Set<WidgetState> states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: Colors.white, size: 22);
        }
        return const IconThemeData(color: AppColors.inkSecondary, size: 22);
      }),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.inverseSurface,
      contentTextStyle:
          AppText.bodyMd.copyWith(color: AppColors.onInverseSurface),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppColors.radiusInput),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.primary,
      linearTrackColor: AppColors.surfaceContainer,
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((Set<WidgetState> states) =>
          states.contains(WidgetState.selected)
              ? AppColors.primary
              : Colors.transparent),
      side: const BorderSide(color: AppColors.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
    ),
  );
}
