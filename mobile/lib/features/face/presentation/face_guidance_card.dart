import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../domain/face_quality.dart';
import '../../device/presentation/helpdesk_sheet.dart';

/// Honest banner title for a failing quality gate. Only the blur gate gets
/// the `Buram` title; lighting and detection gates get their own category so
/// the UI never shows a wrong diagnosis (e.g. `tooBright` must not read as
/// "cahaya kurang", `multipleFaces` gets its detail from the gate message).
String guidanceTitle(FaceGate gate) {
  switch (gate) {
    case FaceGate.tooBlurry:
      return 'Wajah Terdeteksi Buram & Tidak Fokus';
    case FaceGate.tooDark:
      return 'Pencahayaan Kurang';
    case FaceGate.tooBright:
      return 'Pencahayaan Berlebih';
    case FaceGate.eyesClosed:
      return 'Mata Tertutup';
    case FaceGate.noFace:
    case FaceGate.multipleFaces:
    case FaceGate.tooSmall:
    case FaceGate.ok:
      return 'Wajah Tidak Terdeteksi';
  }
}

/// Quality tiles derived ONLY from what the pipeline actually evaluated.
///
/// `evaluateFaceCapture` runs count/size gates before the pixel gates, and
/// `assessQuality` checks lighting before blur. So when the failing gate is a
/// pixel gate, the count gate already passed (face detected, distance ok);
/// when it is `tooBlurry`, lighting already passed. Metrics the pipeline
/// never reached are omitted — never faked.
List<GuidanceTile> guidanceTiles(FaceGate gate) {
  switch (gate) {
    case FaceGate.noFace:
      return const <GuidanceTile>[GuidanceTile('Wajah Terdeteksi', 'Tidak Terdeteksi', false)];
    case FaceGate.multipleFaces:
      return const <GuidanceTile>[GuidanceTile('Wajah Terdeteksi', '>1 Wajah', false)];
    case FaceGate.tooSmall:
      return const <GuidanceTile>[
        GuidanceTile('Wajah Terdeteksi', '1 Wajah', true),
        GuidanceTile('Jarak', 'Terlalu Jauh', false),
      ];
    case FaceGate.tooBlurry:
      return const <GuidanceTile>[
        GuidanceTile('Pencahayaan', 'Cukup', true),
        GuidanceTile('Wajah Terdeteksi', '1 Wajah', true),
        GuidanceTile('Ketajaman', 'Buram', false),
        GuidanceTile('Jarak', 'Ideal', true),
      ];
    case FaceGate.tooDark:
      return const <GuidanceTile>[
        GuidanceTile('Pencahayaan', 'Kurang', false),
        GuidanceTile('Wajah Terdeteksi', '1 Wajah', true),
        GuidanceTile('Jarak', 'Ideal', true),
      ];
    case FaceGate.tooBright:
      return const <GuidanceTile>[
        GuidanceTile('Pencahayaan', 'Berlebih', false),
        GuidanceTile('Wajah Terdeteksi', '1 Wajah', true),
        GuidanceTile('Jarak', 'Ideal', true),
      ];
    case FaceGate.eyesClosed:
      return const <GuidanceTile>[
        GuidanceTile('Mata', 'Tertutup', false),
        GuidanceTile('Wajah Terdeteksi', '1 Wajah', true),
      ];
    case FaceGate.ok:
      return const <GuidanceTile>[];
  }
}

/// One quality tile: label + real state derived from the failing gate.
class GuidanceTile {
  const GuidanceTile(this.label, this.value, this.ok);
  final String label;
  final String value;
  final bool ok;
}

/// Capture-failure guidance card (mockup `pendaftaran_wajah_kendala_pemindaian`).
///
/// Shown ONLY on quality-gate failure ([gate] != ok/null). Server/network
/// errors keep their bare text — they are not capture problems. No simulation
/// toggles, no fake sensor readouts (no ISO/lux/BSSID); tiles come from
/// [guidanceTiles], steps are static instructional copy.
class FaceGuidanceCard extends StatelessWidget {
  const FaceGuidanceCard({
    super.key,
    required this.gate,
    required this.message,
    required this.onRetry,
  });

  final FaceGate gate;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final List<GuidanceTile> tiles = guidanceTiles(gate);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.errorTint,
                borderRadius: BorderRadius.circular(AppColors.radiusInput),
                border: Border.all(color: AppColors.errorBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Icon(Icons.warning, size: 20, color: AppColors.error),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          guidanceTitle(gate),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.errorText,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          message,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.errorText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (tiles.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 2.4,
                children: <Widget>[
                  for (final GuidanceTile t in tiles) _qualityTile(t),
                ],
              ),
            ],
            const SizedBox(height: 12),
            const Text(
              'Langkah Penyelesaian Mandiri:',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const _Step(
              n: '1',
              text: 'Bersihkan lensa kamera depan dengan kain bersih atau tisu kering.',
            ),
            const _Step(
              n: '2',
              text: 'Cari tempat dengan cahaya cukup, hindari membelakangi lampu terang.',
            ),
            const _Step(
              n: '3',
              text: 'Lepas masker, kacamata gelap, atau aksesori penutup wajah sementara bila diizinkan.',
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Coba Pindai Ulang'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => showHelpdeskSheet(context),
              icon: const Icon(Icons.support_agent),
              label: const Text('Gunakan Bantuan Manual / CS IT'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _qualityTile(GuidanceTile t) => Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: t.ok ? AppColors.canvas : AppColors.errorTint.withOpacity(0.4),
          borderRadius: BorderRadius.circular(AppColors.radiusInput),
          border: Border.all(color: t.ok ? AppColors.border : AppColors.errorBorder),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Text(
                    t.label,
                    style: const TextStyle(fontSize: 11, color: AppColors.inkSecondary),
                  ),
                  Text(
                    t.value,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            Icon(
              t.ok ? Icons.check_circle : Icons.error,
              size: 18,
              color: t.ok ? AppColors.success : AppColors.error,
            ),
          ],
        ),
      );
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.text});
  final String n;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Text(
                n,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.inkSecondary,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      );
}
