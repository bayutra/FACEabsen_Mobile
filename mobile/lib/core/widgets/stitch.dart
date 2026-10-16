import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Shared building blocks from the Stitch export
/// `design/stitch_rs_absen_mobile_app` ("Clinical Attendance & Identity") so
/// every screen speaks the same visual language.

/// Status pill used for request/workflow states, mapped to the triage tiers in
/// the design spec.
class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key, this.label});

  final String status;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, Color border) = switch (status) {
      'APPROVED' || 'ON_TIME' || 'NORMAL_CHECKOUT' || 'ACTIVE' => (
          AppColors.successTint,
          AppColors.successText,
          AppColors.successBorder,
        ),
      'PENDING' || 'LATE' || 'VERY_LATE' || 'EARLY_CHECKOUT' => (
          AppColors.warningTint,
          AppColors.warningText,
          AppColors.warningBorder,
        ),
      'REJECTED' || 'REVOKED' || 'INACTIVE' => (
          AppColors.errorTint,
          AppColors.errorText,
          AppColors.errorBorder,
        ),
      'CANCELLED' || 'LOST' || 'REPLACED' => (
          AppColors.surfaceContainer,
          AppColors.inkSecondary,
          AppColors.border,
        ),
      _ => (
          AppColors.infoTint,
          AppColors.info,
          AppColors.surfaceHighest,
        ),
    };
    return AppPill(label ?? status, bg, fg, border: border);
  }
}

/// Pill badge: 28px tall, 12px horizontal padding, full radius, `label-md`.
class AppPill extends StatelessWidget {
  const AppPill(
    this.label,
    this.bg,
    this.fg, {
    super.key,
    this.icon,
    this.border,
  });

  final String label;
  final Color bg;
  final Color fg;
  final IconData? icon;

  /// Optional 1px outline; the spec draws a border on every badge tier.
  final Color? border;

  @override
  Widget build(BuildContext context) => Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppColors.radiusFull),
          border: border != null ? Border.all(color: border!) : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            if (icon != null) ...<Widget>[
              Icon(icon, size: 14, color: fg),
              const SizedBox(width: 6),
            ],
            Flexible(
              child: Text(
                label,
                style: AppText.labelMd.copyWith(color: fg),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      );
}

/// Pressable wrapper implementing spec active compress scale 0.98 for
/// primary CTAs (52px, #0F766E, radius 16).
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, required this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? AppColors.pressScale : 1.0,
          duration: const Duration(milliseconds: 120),
          child: widget.child,
        ),
      );
}

/// Stitch sticky header — px-16 py-8, bg-surface/95 blur, border-b.
/// Varian linear: back 40px circle + judul 18/600 + subtitle 11 + badge kanan.
/// Varian home: avatar 40px + sapaan + trailing actions.
class StitchHeader extends StatelessWidget implements PreferredSizeWidget {
  const StitchHeader({
    super.key,
    this.title,
    this.subtitle,
    this.trailing,
    this.onBack,
    this.avatar,
    this.greeting,
    this.name,
  });

  final String? title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onBack;
  final Widget? avatar;
  final String? greeting;
  final String? name;

  /// 3 baris (sapaan + nama + subtitle) butuh slot lebih tinggi —
  /// tanpa ini Column overflow 5px di layar 1080x2400.
  bool get _threeLines => greeting != null && subtitle != null;

  @override
  Size get preferredSize => Size.fromHeight(_threeLines ? 76 : 64);

  @override
  Widget build(BuildContext context) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surfaceLowest,
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppColors.pageMargin,
              vertical: AppColors.headerPy,
            ),
            child: Row(
              children: [
                if (onBack != null)
                  Container(
                    width: 40,
                    height: 40,
                    margin: const EdgeInsets.only(right: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLowest,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.inputBorder),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back, size: 20),
                      color: AppColors.ink,
                      onPressed: onBack,
                      padding: EdgeInsets.zero,
                    ),
                  ),
                if (avatar != null) ...[avatar!, const SizedBox(width: 12)],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (greeting != null)
                        Text(
                          greeting!,
                          style: AppText.labelSm
                              .copyWith(color: AppColors.inkSecondary),
                        ),
                      Text(
                        name ?? title ?? '',
                        style: AppText.headlineSm.copyWith(color: AppColors.ink),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          style: AppText.labelSm
                              .copyWith(color: AppColors.inkSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: 8),
                  trailing!,
                ],
              ],
            ),
          ),
        ),
      );
}

/// Stepper 1-2-3 ala Stitch (daftarkan perangkat, penggantian).
class StitchStepper extends StatelessWidget {
  const StitchStepper({
    super.key,
    required this.steps,
    required this.current,
  });

  final List<String> steps;
  final int current;

  @override
  Widget build(BuildContext context) => AppCard(
        child: Row(
          children: [
            for (int i = 0; i < steps.length; i++) ...[
              _dot(i),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Langkah ${i + 1}',
                      style: AppText.labelSm
                          .copyWith(color: AppColors.inkSecondary),
                    ),
                    Text(
                      steps[i],
                      style: AppText.bodyMdMedium.copyWith(
                        color: i == current
                            ? AppColors.primaryContainer
                            : AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
              if (i < steps.length - 1)
                Container(
                  width: 24,
                  height: 1,
                  color: AppColors.border,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                ),
            ],
          ],
        ),
      );

  Widget _dot(int i) {
    final bool done = i < current;
    final bool active = i == current;
    final Color bg = done
        ? AppColors.successTint
        : active
            ? AppColors.tealBadgeBg
            : AppColors.surfaceLow;
    final Color fg = done
        ? AppColors.successText
        : active
            ? AppColors.tealBadgeText
            : AppColors.inkSecondary;
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: Border.all(
          color: done
              ? AppColors.successBorder
              : active
                  ? AppColors.tealBadgeBorder
                  : AppColors.border,
        ),
      ),
      child: Center(
        child: done
            ? Icon(Icons.check, size: 16, color: fg)
            : Text(
                '${i + 1}',
                style:
                    AppText.labelMd.copyWith(color: fg),
              ),
      ),
    );
  }
}

/// Section title with an optional trailing action.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: <Widget>[
            Expanded(child: Text(title, style: AppText.bodyMdMedium)),
            if (trailing != null) trailing!,
          ],
        ),
      );
}

/// Elevation-1 card: white surface, 1px border, 16px radius, soft slate shadow.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding, this.accent, this.onTap});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  /// 4px accent line docked to the top border, used by the geofence module to
  /// encode "inside" (green) vs "outside" (red) at a glance.
  final Color? accent;

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Widget body = Padding(
      padding: padding ?? const EdgeInsets.all(AppColors.pageMargin),
      child: child,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(AppColors.radiusCard),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.shadow1,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppColors.radiusCard),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (accent != null) Container(height: 4, color: accent),
            if (onTap == null)
              body
            else
              Material(
                color: Colors.transparent,
                child: InkWell(onTap: onTap, child: body),
              ),
          ],
        ),
      ),
    );
  }
}

/// Compact loading state that keeps the same clinical spacing as empty/error
/// states instead of showing a bare spinner on a blank page.
class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.label = 'Memuat data'});

  final String label;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 56),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
              const SizedBox(height: 12),
              Text(label, style: AppText.labelMd.copyWith(color: AppColors.inkSecondary)),
            ],
          ),
        ),
      );

}

/// Shared list action row for settings, profile, and workflow hubs.
class ActionTile extends StatelessWidget {
  const ActionTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.tone = InfoBannerTone.info,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final InfoBannerTone tone;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, Color border) = switch (tone) {
      InfoBannerTone.success => (
          AppColors.successTint,
          AppColors.successText,
          AppColors.successBorder,
        ),
      InfoBannerTone.warning => (
          AppColors.warningTint,
          AppColors.warningText,
          AppColors.warningBorder,
        ),
      InfoBannerTone.error => (
          AppColors.errorTint,
          AppColors.errorText,
          AppColors.errorBorder,
        ),
      InfoBannerTone.info => (
          AppColors.tealBadgeBg,
          AppColors.tealBadgeText,
          AppColors.tealBadgeBorder,
        ),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: <Widget>[
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(AppColors.radiusInput),
                border: Border.all(color: border),
              ),
              child: Icon(icon, color: fg, size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: AppText.bodyMdMedium),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.inkSecondary),
          ],
        ),
      ),
    );
  }
}

/// Friendly zero-state with a call to action.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(
                  color: AppColors.tealBadgeBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 28, color: AppColors.tealBadgeText),
              ),
              const SizedBox(height: 12),
              Text(title, textAlign: TextAlign.center, style: AppText.bodyMdMedium),
              if (subtitle != null) ...<Widget>[
                const SizedBox(height: 4),
                Text(
                  subtitle!,
                  textAlign: TextAlign.center,
                  style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                ),
              ],
              if (action != null) ...<Widget>[const SizedBox(height: 14), action!],
            ],
          ),
        ),
      );
}

enum InfoBannerTone { info, success, warning, error }

/// Inline informational / warning banner.
class InfoBanner extends StatelessWidget {
  const InfoBanner(this.text, {super.key, this.tone = InfoBannerTone.info, this.title});

  final String text;
  final String? title;
  final InfoBannerTone tone;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color border, Color fg, IconData icon) = switch (tone) {
      InfoBannerTone.success => (
          AppColors.successTint,
          AppColors.successBorder,
          AppColors.successText,
          Icons.verified,
        ),
      InfoBannerTone.warning => (
          AppColors.warningTint,
          AppColors.warningBorder,
          AppColors.warningText,
          Icons.info_outline,
        ),
      InfoBannerTone.error => (
          AppColors.errorTint,
          AppColors.errorBorder,
          AppColors.errorText,
          Icons.error_outline,
        ),
      InfoBannerTone.info => (
          AppColors.infoTint,
          AppColors.surfaceHighest,
          AppColors.info,
          Icons.info_outline,
        ),
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppColors.radiusInput),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                if (title != null) Text(title!, style: AppText.labelMd.copyWith(color: fg)),
                Text(
                  text,
                  style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Label + value row used in receipt-style detail cards. Times render with
/// tabular figures so a column of clock values stays aligned.
class DetailRow extends StatelessWidget {
  const DetailRow(this.label, this.value, {super.key, this.bold = false, this.isTime = false});

  final String label;
  final String value;
  final bool bold;
  final bool isTime;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(
              width: 116,
              child: Text(
                label,
                style: AppText.labelSm.copyWith(color: AppColors.inkSecondary),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: isTime
                    ? AppText.metricSmall(size: 12).copyWith(
                        fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                      )
                    : AppText.bodyMdMedium.copyWith(
                        fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                      ),
              ),
            ),
          ],
        ),
      );
}

/// Monospace-style readout for the live clock on the biometric screens.
class MetricReadout extends StatelessWidget {
  const MetricReadout(this.text, {super.key, this.color, this.size = 32});

  final String text;
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: AppText.metricSmall(size: size).copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.64,
          height: 36 / size,
          color: color ?? AppColors.ink,
        ),
      );
}
