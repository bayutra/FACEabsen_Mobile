import 'package:dio/dio.dart';
import 'package:face_absen_mobile/features/face/data/face_detector.dart';
import 'package:face_absen_mobile/features/face/data/face_embedder.dart';
import 'package:face_absen_mobile/features/face/data/face_repository.dart';
import 'package:face_absen_mobile/features/face/domain/face_quality.dart';
import 'package:face_absen_mobile/features/face/presentation/face_guidance_card.dart';
import 'package:face_absen_mobile/features/face/presentation/face_registration_screen.dart';
import 'package:face_absen_mobile/features/face/presentation/face_scan_issue_screen.dart';
import 'package:face_absen_mobile/features/liveness/presentation/passive_scan_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Regression tests for the biometric screens rebuilt on the clinical HUD.
///
/// The designs are dense and were tuned for 320 px-wide devices. Flutter's
/// test font (Ahem) renders every glyph as a square, so these probes are
/// stricter than a real device: an overflow here means the layout would also
/// break with long names or large accessibility text.
FaceRepository _faces() => FaceRepository(
      dio: Dio(),
      detector: FaceDetectorService(),
      embedder: FaceEmbedder(),
    );

Future<void> _pumpAt(WidgetTester tester, Size size, Widget child) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(MaterialApp(home: child));
  for (int i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 120));
  }
}

void main() {
  for (final FaceGate gate in <FaceGate>[
    FaceGate.tooBlurry,
    FaceGate.tooDark,
    FaceGate.multipleFaces,
    FaceGate.noFace,
  ]) {
    testWidgets('scan issue ${gate.name} fits 320px', (WidgetTester tester) async {
      await _pumpAt(
        tester,
        const Size(320, 640),
        FaceScanIssueScreen(
          gate: gate,
          onRetry: () {},
          onHelp: () {},
        ),
      );

      await tester.scrollUntilVisible(
        find.text('Langkah Penyelesaian Mandiri:'),
        240,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pump(const Duration(milliseconds: 200));

      expect(tester.takeException(), isNull);
      expect(find.text('Langkah Penyelesaian Mandiri:'), findsOneWidget);
    });
  }

  for (final FaceGate gate in <FaceGate>[
    FaceGate.tooBlurry,
    FaceGate.tooDark,
    FaceGate.multipleFaces,
  ]) {
    testWidgets('guidance card ${gate.name} fits 320px',
        (WidgetTester tester) async {
      await _pumpAt(
        tester,
        const Size(320, 640),
        Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: FaceGuidanceCard(
              gate: gate,
              message: 'Pesan diagnostik contoh untuk pengujian tata letak.',
              onRetry: () {},
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('face registration fits 320x640 without camera',
      (WidgetTester tester) async {
    await _pumpAt(
      tester,
      const Size(320, 640),
      FaceRegistrationScreen(
        faces: _faces(),
        displayName: 'Ns. Siti Rahma, S.Kep',
        employeeNo: '19940812-2020-04',
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Panduan Perekaman'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Ambil & Daftarkan Wajah'),
      240,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(tester.takeException(), isNull);
    expect(find.text('Ambil & Daftarkan Wajah'), findsOneWidget);
  });

  testWidgets('passive liveness fits 320x640 without camera',
      (WidgetTester tester) async {
    await _pumpAt(
      tester,
      const Size(320, 640),
      PassiveScanScreen(
        faces: _faces(),
        displayName: 'Ns. Siti Rahma, S.Kep',
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Verifikasi Kehadiran'), findsOneWidget);
    expect(find.text('Pindai Sekarang'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Enkripsi Biometrik ISO/IEC 30107-3 Liveness Anti-Spoofing'),
      240,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(tester.takeException(), isNull);
  });
}
