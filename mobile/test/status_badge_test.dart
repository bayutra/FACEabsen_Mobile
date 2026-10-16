import 'package:face_absen_mobile/core/widgets/status_badge.dart';
import 'package:face_absen_mobile/features/device/domain/device_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('StatusBadge renders Indonesian label per status', (tester) async {
    for (final s in DeviceStatus.values) {
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: StatusBadge(status: s))));
      expect(find.text(deviceStatusLabel(s)), findsOneWidget);
    }
  });
}
