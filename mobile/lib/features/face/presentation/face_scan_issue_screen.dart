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
          'Kamera goyang atau lensa kotor. Hasil pemindaian tidak memenuhi '
              'standar biometrik klinis.',
        FaceGate.tooDark =>
          'Pencahayaan ruangan terlalu rendah untuk verifikasi wajah.',
        FaceGate.tooBright =>
          'Cahaya langsung ke kamera membuat wajah tidak terbaca.',
        FaceGate.eyesClosed =>
          'Mata tertutup saat pemindaian sehingga liveness tidak terpenuhi.',
        FaceGate.multipleFaces =>
          'Terdeteksi lebih dari satu wajah di area kamera.',
        FaceGate.noFace =>
          'Wajah tidak terdeteksi di dalam bingkai kamera.',
        FaceGate.tooSmall =>
          'Wajah terlalu jauh sehingga detail biometrik tidak cukup.',
        FaceGate.ok => 'Posisikan wajah di tengah bingkai dan coba kembali.',
      };

  List<String> get _steps => switch (_activeGate) {
        FaceGate.tooBlurry => const <String>[
            'Bersihkan lensa kamera depan dengan kain bersih atau tisu kering.',
            'Pegang ponsel dengan stabil atau sandarkan siku pada meja/dinding.',
            'Hindari gerakan cepat atau berbicara saat indikator lingkaran '
                'sensor biometrik berputar.',
          ],
        FaceGate.tooDark => const <String>[
            'Pindah ke area dengan cahaya merata, misalnya dekat jendela.',
            'Hadapkan wajah ke sumber cahaya, jangan membelakanginya.',
            'Nyalakan cahaya layar tambahan bila ruangan tetap redup.',
          ],
        FaceGate.tooBright => const <String>[
            'Jauhi lampu sorot atau jendela yang menyorot langsung ke kamera.',
            'Berdirilah membelakangi sumber cahaya agar wajah tidak silau.',
            'Lap lensa kamera untuk mengurangi pantulan cahaya.',
          ],
        FaceGate.eyesClosed => const <String>[
            'Buka mata dan tatap kamera selama pemindaian berlangsung.',
            'Pastikan tidak ada pantulan kacamata yang menutupi mata.',
            'Coba lagi saat mata tidak lelah atau berkedip cepat.',
          ],
        FaceGate.multipleFaces => const <String>[
            'Pastikan hanya wajah Anda yang terlihat di kamera.',
            'Minta rekan di sekitar bergeser dari area pandang kamera.',
            'Ulangi pemindaian saat sendirian di depan kamera.',
          ],
        FaceGate.noFace => const <String>[
            'Periksa izin kamera pada pengaturan perangkat.',
            'Posisikan wajah di tengah bingkai dengan mata terbuka.',
            'Bersihkan lensa kamera lalu pindai ulang.',
          ],
        FaceGate.tooSmall => const <String>[
            'Dekatkan ponsel hingga wajah memenuhi bingkai.',
            'Jaga jarak ideal sekitar 45 cm dari kamera.',
            'Hindari zoom digital karena menurunkan kualitas biometrik.',
          ],
        FaceGate.ok => const <String>[
            'Posisikan wajah di tengah bingkai.',
            'Pastikan pencahayaan cukup dan mata terbuka.',
            'Coba pindai ulang.',
          ],
      };

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.surfaceLow,
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
            GuidanceTileGrid(
              tiles: _tiles,
              builder: (GuidanceTile tile) => _QualityTile(
                  label: tile.label, value: tile.value, ok: tile.ok),
            ),
            const SizedBox(height: 12),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.warningTint,
                      borderRadius:
                          BorderRadius.circular(AppColors.radiusInput),
                      border: Border.all(color: AppColors.warningBorder),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const Icon(Icons.warning_amber_rounded,
                            size: 20, color: AppColors.warningText),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                'Diagnostik Kegagalan Verifikasi',
                                style: AppText.labelMd
                                    .copyWith(color: AppColors.warningText),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                _troubleshoot,
                                style: AppText.labelSm.copyWith(
                                  color: AppColors.inkSecondary,
                                  height: 1.45,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Langkah Penyelesaian Mandiri:',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 10),
                  for (int i = 0; i < _steps.length; i++)
                    _HelpStep(n: '${i + 1}', text: _steps[i]),
                ],
              ),
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

class _HelpStep extends StatelessWidget {
  const _HelpStep({required this.n, required this.text});

  final String n;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.surfaceLow,
                shape: BoxShape.circle,
              ),
              child: Text(
                n,
                style: AppText.labelSm.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: AppText.labelSm.copyWith(
                  color: AppColors.inkSecondary,
                  height: 1.5,
                ),
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
