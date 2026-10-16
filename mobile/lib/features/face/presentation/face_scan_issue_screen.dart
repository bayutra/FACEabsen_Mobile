import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../domain/face_quality.dart';

/// Stitch `pendaftaran_wajah_kendala_pemindaian` — 3 skenario
/// Blur / Wajah Ganda / Wajah Hilang, viewport dark 24px, grid mutu 2x2,
/// diagnostik amber, CTA 52px + ghost 48px.
class FaceScanIssueScreen extends StatefulWidget {
  const FaceScanIssueScreen(
      {super.key, this.onRetry, this.onHelp, this.initialTab = 0});

  final VoidCallback? onRetry;
  final VoidCallback? onHelp;

  /// Tab awal 0=Blur, 1=Wajah Ganda, 2=Wajah Hilang.
  final int initialTab;

  /// Petakan hasil diagnosis pipeline ke tab yang relevan — tidak menebak:
  /// gate piksel/jarak masuk ke Blur, sisanya sesuai hitungan wajah.
  static int tabForGate(FaceGate gate) => switch (gate) {
        FaceGate.multipleFaces => 1,
        FaceGate.noFace => 2,
        _ => 0,
      };

  @override
  State<FaceScanIssueScreen> createState() => _FaceScanIssueScreenState();
}

class _FaceScanIssueScreenState extends State<FaceScanIssueScreen> {
  late int _tab;
  static const List<String> _tabs = ['Blur', 'Wajah Ganda', 'Wajah Hilang'];

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab.clamp(0, _tabs.length - 1);
  }

  String get _alertTitle => switch (_tab) {
        0 => 'Gambar Buram — Ketajaman 42%',
        1 => 'Terdeteksi Lebih dari 1 Wajah',
        _ => 'Wajah Hilang dari Bingkai',
      };

  String get _alertDesc => switch (_tab) {
        0 =>
          'Sensor buram (ISO 800, 1/40s). Bersihkan lensa, naikkan cahaya ke ±420 Lux, dan tahan perangkat 45 cm.',
        1 =>
          'Pastikan hanya wajah Anda di dalam lingkaran. Minta rekan bergeser dari bingkai kamera.',
        _ =>
          'Posisikan wajah di dalam lingkaran target. Jaga jarak 40–50 cm dan tatap kamera.',
      };

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.canvas,
        appBar: StitchHeader(
          title: 'Registrasi Wajah',
          subtitle: 'Biometrik Shift • Perekaman Terkendala',
          onBack: () => Navigator.of(context).pop(),
          trailing: const AppPill(
            'Terkendala',
            AppColors.roseTint,
            AppColors.roseText,
            border: AppColors.roseBorder,
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.all(AppColors.pageMargin),
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius:
                    BorderRadius.circular(AppColors.radiusInput),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  for (int i = 0; i < _tabs.length; i++)
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _tab = i),
                        child: Container(
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: i == _tab
                                ? AppColors.surfaceLowest
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            border: i == _tab
                                ? Border.all(
                                    color: AppColors.roseBorder)
                                : null,
                          ),
                          child: Text(
                            _tabs[i],
                            style: AppText.labelMd.copyWith(
                              color: i == _tab
                                  ? AppColors.roseText
                                  : AppColors.inkSecondary,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            InfoBanner(_alertDesc,
                title: _alertTitle, tone: InfoBannerTone.error),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: AppColors.inverseSurface,
                borderRadius:
                    BorderRadius.circular(AppColors.radiusHero),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Container(
                    height: 240,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(
                          AppColors.radiusViewport),
                      border: Border.all(
                        color: AppColors.roseFill,
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.face,
                              size: 64, color: Colors.white70),
                          const SizedBox(height: 8),
                          AppPill(
                            _tab == 0
                                ? 'Sensor Buram (42%)'
                                : _tab == 1
                                    ? '2 Wajah Terdeteksi'
                                    : 'Wajah Hilang',
                            AppColors.roseTint,
                            AppColors.roseText,
                            border: AppColors.roseBorder,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('ISO 800 • Exp 1/40',
                          style: AppText.labelSm.copyWith(
                              color: AppColors.onInverseSurface)),
                      Text('420 Lux RSUD OK',
                          style: AppText.labelSm.copyWith(
                              color: AppColors.onInverseSurface)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 2.4,
              children: const [
                _QualityTile(
                    label: 'Pencahayaan', value: 'OK', ok: true),
                _QualityTile(
                    label: 'Wajah', value: '1 Valid', ok: true),
                _QualityTile(
                    label: 'Ketajaman', value: 'Gagal', ok: false),
                _QualityTile(
                    label: 'Jarak', value: '45 cm', ok: true),
              ],
            ),
            const SizedBox(height: 12),
            const InfoBanner(
              '1. Lap lensa kamera  2. Hadap sumber cahaya  3. Jarak 45 cm, tatap kamera. Ref: SOP-PRES-BIO-V4.',
              title: 'Diagnostik & Tips Perbaikan',
              tone: InfoBannerTone.warning,
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: AppColors.buttonHeight,
              child: FilledButton.icon(
                onPressed: widget.onRetry ??
                    () => Navigator.of(context).pop(true),
                icon: const Icon(Icons.refresh, size: 20),
                label: const Text('Coba Pindai Ulang'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: AppColors.ghostHeight,
              child: OutlinedButton.icon(
                onPressed: widget.onHelp ??
                    () => Navigator.of(context).pop(false),
                icon: const Icon(Icons.support_agent, size: 20),
                label: const Text('Bantuan Manual'),
              ),
            ),
          ],
        ),
      );
}

class _QualityTile extends StatelessWidget {
  const _QualityTile(
      {required this.label, required this.value, required this.ok});

  final String label;
  final String value;
  final bool ok;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surfaceLowest,
          borderRadius:
              BorderRadius.circular(AppColors.radiusCardSmall),
          border: Border.all(
              color: ok
                  ? AppColors.successBorder
                  : AppColors.roseBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: AppText.labelSm),
            Text(
              value,
              style: AppText.bodyMdMedium.copyWith(
                color: ok
                    ? AppColors.successText
                    : AppColors.roseText,
              ),
            ),
          ],
        ),
      );
}
