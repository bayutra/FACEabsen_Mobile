import 'package:face_absen_mobile/features/device/presentation/device_screen.dart';
import 'package:face_absen_mobile/features/device/presentation/device_sections.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';





void main() {
  group('perangkat (tab Perangkat)', () {
    testWidgets('menampilkan status perangkat, bukan pengajuan penggantian',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DeviceScreen(devices: FakeDeviceRepository()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DeviceStatusSection), findsOneWidget);
      expect(find.text('Ajukan Penggantian Perangkat'), findsNothing);
    });
  });

  group('device status (tab Perangkat)', () {
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
