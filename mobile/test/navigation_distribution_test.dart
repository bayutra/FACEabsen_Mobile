import 'package:face_absen_mobile/features/device/presentation/device_sections.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

/// Pembagian layar per tab Stitch (Beranda, Riwayat, Jadwal, Perangkat,
/// Profil): presensi & pengajuan berjalan sebagai alur linear, bukan tab.
/// Test ini mengunci tiap entry point agar distribusi tidak diam-diam
/// kembali menjadi junk drawer.
void main() {
  group('device change requests (tab Perangkat)', () {
    testWidgets('shows the replacement request entry point',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: DeviceChangeRequestSection(devices: FakeDeviceRepository())),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Ajukan Penggantian Perangkat'), findsOneWidget);
    });

    testWidgets('says so when there is no request yet',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: DeviceChangeRequestSection(devices: FakeDeviceRepository())),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Belum ada riwayat pengajuan'), findsOneWidget);
    });
  });

  group('device status (Profil tab)', () {
    testWidgets('warns when no device is bound, since punching needs one',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: DeviceStatusSection(devices: FakeDeviceRepository())),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Belum ada perangkat terdaftar'), findsOneWidget);
    });
  });
}
