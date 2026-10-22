import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/stitch.dart';
import '../domain/face_quality.dart';
import 'face_guidance_card.dart';

class FaceScanIssueScreen extends StatefulWidget {
  const FaceScanIssueScreen(
      {super.key,
      this.onRetry,
      this.onHelp,
      this.initialTab = 0,
      this.gate,
      this.message});

  final VoidCallback? onRetry;
  final VoidCallback? onHelp;

  final int initialTab;
  final FaceGate? gate;
  final String? message;

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

  FaceGate get _activeGate =>
      widget.gate ??
      switch (_tab) {
        1 => FaceGate.multipleFaces,
        2 => FaceGate.noFace,
        _ => FaceGate.tooBlurry,
      };

  String get _alertTitle => widget.gate == null
      ? switch (_activeGate) {
          FaceGate.multipleFaces => 'Terdeteksi Lebih dari 1 Wajah',
          FaceGate.noFace => 'Wajah Tidak Terdeteksi',
          _ => 'Pemeriksaan Wajah Gagal',
        }
      : guidanceTitle(_activeGate);

  String get _alertDesc =>
      widget.message ??
      switch (_activeGate) {
        FaceGate.tooBlurry =>
          'Tahan ponsel dengan stabil dan bersihkan lensa kamera.',
        FaceGate.tooDark =>
          'Pindah ke tempat yang lebih terang dan hadap sumber cahaya.',
        FaceGate.tooBright =>
          'Hindari cahaya langsung yang mengarah ke kamera.',
        FaceGate.eyesClosed => 'Buka mata dan tatap kamera dengan nyaman.',
        FaceGate.multipleFaces =>
          'Pastikan hanya wajah Anda yang terlihat di kamera.',
        FaceGate.noFace => 'Posisikan wajah di tengah bingkai kamera.',
        FaceGate.tooSmall => 'Dekatkan wajah ke kamera hingga terlihat jelas.',
        FaceGate.ok => 'Periksa posisi wajah, pencahayaan, lalu coba kembali.',
      };

  List<GuidanceTile> get _tiles => guidanceTiles(_activeGate);

  String get _troubleshoot => switch (_activeGate) {
        FaceGate.tooBlurry =>
          'Tahan ponsel tetap stabil dan pastikan lensa bersih.',
        FaceGate.tooDark =>
          'Cari pencahayaan merata; hindari membelakangi sumber cahaya.',
        FaceGate.tooBright =>
          'Hindari cahaya kuat yang langsung mengenai kamera.',
        FaceGate.eyesClosed => 'Buka mata dan tatap kamera selama pemindaian.',
        FaceGate.multipleFaces => 'Minta orang lain keluar dari area kamera.',
        FaceGate.noFace =>
          'Pastikan izin kamera aktif dan wajah berada di dalam bingkai.',
        FaceGate.tooSmall => 'Dekatkan ponsel sampai wajah mudah dikenali.',
        FaceGate.ok => 'Posisikan wajah di tengah bingkai dan coba kembali.',
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
            InfoBanner(_alertDesc,
                title: _alertTitle, tone: InfoBannerTone.error),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: AppColors.inverseSurface,
                borderRadius: BorderRadius.circular(AppColors.radiusHero),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Container(
                    height: 360,
                    decoration: BoxDecoration(
                      borderRadius:
                          BorderRadius.circular(AppColors.radiusViewport),
                      border: Border.all(
                        color: AppColors.roseFill,
                        width: 2,
                      ),
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        const CustomPaint(
                          painter: _CameraGuidePainter(AppColors.roseFill),
                        ),
                        Positioned(
                          top: 18,
                          left: 18,
                          child: AppPill(
                            'KAMERA DEPAN',
                            AppColors.inverseSurface.withOpacity(0.88),
                            AppColors.onInverseSurface,
                            icon: Icons.camera_alt_outlined,
                          ),
                        ),
                        Center(
                          child: Container(
                            width: 216,
                            height: 272,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(120),
                              border: Border.all(
                                color: AppColors.roseFill.withOpacity(0.85),
                                width: 2,
                              ),
                              color: AppColors.roseFill.withOpacity(0.06),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.face_retouching_natural,
                                    size: 64, color: Colors.white70),
                                const SizedBox(height: 12),
                                AppPill(
                                  switch (_activeGate) {
                                    FaceGate.tooBlurry => 'Gambar Buram',
                                    FaceGate.tooDark => 'Pencahayaan Kurang',
                                    FaceGate.tooBright =>
                                      'Pencahayaan Berlebih',
                                    FaceGate.eyesClosed => 'Mata Tertutup',
                                    FaceGate.multipleFaces =>
                                      'Wajah Lebih dari Satu',
                                    FaceGate.noFace => 'Wajah Tidak Terdeteksi',
                                    FaceGate.tooSmall => 'Wajah Terlalu Jauh',
                                    FaceGate.ok => 'Perlu Pemindaian Ulang',
                                  },
                                  AppColors.roseTint,
                                  AppColors.roseText,
                                  border: AppColors.roseBorder,
                                ),
                              ],
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 18,
                          left: 18,
                          right: 18,
                          child: Text(
                            'Panduan pemeriksaan kamera',
                            textAlign: TextAlign.center,
                            style: AppText.labelSm.copyWith(
                              color: AppColors.onInverseSurface,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text('Hasil pemeriksaan kamera',
                      style: AppText.labelSm
                          .copyWith(color: AppColors.onInverseSurface)),
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
              children: [
                for (final GuidanceTile tile in _tiles)
                  _QualityTile(
                      label: tile.label, value: tile.value, ok: tile.ok),
              ],
            ),
            const SizedBox(height: 12),
            InfoBanner(
              _troubleshoot,
              title: 'Diagnostik & Tips Perbaikan',
              tone: InfoBannerTone.warning,
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: AppColors.buttonHeight,
              child: FilledButton.icon(
                onPressed:
                    widget.onRetry ?? () => Navigator.of(context).pop(true),
                icon: const Icon(Icons.refresh, size: 20),
                label: const Text('Coba Pindai Ulang'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: AppColors.ghostHeight,
              child: OutlinedButton.icon(
                onPressed:
                    widget.onHelp ?? () => Navigator.of(context).pop(false),
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
          borderRadius: BorderRadius.circular(AppColors.radiusCardSmall),
          border: Border.all(
              color: ok ? AppColors.successBorder : AppColors.roseBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: AppText.labelSm),
            Text(
              value,
              style: AppText.bodyMdMedium.copyWith(
                color: ok ? AppColors.successText : AppColors.roseText,
              ),
            ),
          ],
        ),
      );
}

class _CameraGuidePainter extends CustomPainter {
  const _CameraGuidePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    const double inset = 18;
    const double length = 28;
    final double right = size.width - inset;
    final double bottom = size.height - inset;
    for (final (Offset start, Offset end) in <(Offset, Offset)>[
      (const Offset(inset, inset), const Offset(inset + length, inset)),
      (const Offset(inset, inset), const Offset(inset, inset + length)),
      (Offset(right, inset), Offset(right - length, inset)),
      (Offset(right, inset), Offset(right, inset + length)),
      (Offset(inset, bottom), Offset(inset + length, bottom)),
      (Offset(inset, bottom), Offset(inset, bottom - length)),
      (Offset(right, bottom), Offset(right - length, bottom)),
      (Offset(right, bottom), Offset(right, bottom - length)),
    ]) {
      canvas.drawLine(start, end, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _CameraGuidePainter oldDelegate) =>
      oldDelegate.color != color;
}
