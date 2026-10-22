import 'package:face_absen_mobile/features/auth/presentation/register_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

void main() {
  Future<void> openRegister(
    WidgetTester tester, {
    required FakeAuthRepository auth,
    required FakeDeviceRepository devices,
    void Function(bool?)? onResult,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (BuildContext context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () async {
                  final bool? result = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      builder: (_) => RegisterScreen(auth: auth, devices: devices),
                    ),
                  );
                  onResult?.call(result);
                },
                child: const Text('buka'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('buka'));
    await tester.pumpAndSettle();
  }

  Future<void> selectUnit(WidgetTester tester) async {
    final Finder dropdown = find.byType(DropdownButtonFormField<String>);
    await tester.ensureVisible(dropdown);
    await tester.pumpAndSettle();
    await tester.tap(dropdown);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Instalasi Rawat Inap').last);
    await tester.pumpAndSettle();
  }

  testWidgets('pendaftaran sukses menutup layar dan mengembalikan true',
      (tester) async {    bool? result;
    final auth = FakeAuthRepository();
    final devices = FakeDeviceRepository();
    await openRegister(
      tester,
      auth: auth,
      devices: devices,
      onResult: (bool? value) => result = value,
    );

    expect(find.text('Daftar Akun'), findsOneWidget);

    
    await selectUnit(tester);

    
    await tester.enterText(find.byType(TextField).at(0), 'Budi Baru');
    await tester.enterText(find.byType(TextField).at(1), 'budi@rs.test');
    await tester.enterText(find.byType(TextField).at(4), 'Password123!');
    await tester.enterText(find.byType(TextField).at(5), 'Password123!');
    final Finder submit = find.text('Daftar & Masuk');
    await tester.ensureVisible(submit);
    await tester.pumpAndSettle();
    await tester.tap(submit);
    await tester.pumpAndSettle();

    expect(result, isTrue);
    expect(find.text('Daftar Akun'), findsNothing);
    expect(devices.registerCalls, 1);
    expect(auth.lastRegisterUnit, 'dept-1');
  });

  testWidgets('unit kerja wajib dipilih sebelum mengirim', (tester) async {
    final devices = FakeDeviceRepository();
    await openRegister(
      tester,
      auth: FakeAuthRepository(),
      devices: devices,
    );

    await tester.enterText(find.byType(TextField).at(0), 'Budi Baru');
    await tester.enterText(find.byType(TextField).at(1), 'budi@rs.test');
    await tester.enterText(find.byType(TextField).at(4), 'Password123!');
    await tester.enterText(find.byType(TextField).at(5), 'Password123!');
    final Finder submit = find.text('Daftar & Masuk');
    await tester.ensureVisible(submit);
    await tester.pumpAndSettle();
    await tester.tap(submit);
    await tester.pumpAndSettle();

    expect(find.text('Unit kerja wajib dipilih.'), findsOneWidget);
    expect(devices.registerCalls, 0);
  });

  testWidgets('email sudah terdaftar menampilkan pesan Indonesia',
      (tester) async {
    await openRegister(
      tester,
      auth: FakeAuthRepository(failRegister: true),
      devices: FakeDeviceRepository(),
    );

    await tester.enterText(find.byType(TextField).at(0), 'Budi Baru');
    await tester.enterText(find.byType(TextField).at(1), 'employee@rs.test');
    await tester.enterText(find.byType(TextField).at(4), 'Password123!');
    await tester.enterText(find.byType(TextField).at(5), 'Password123!');
    await selectUnit(tester);
    final Finder submit = find.text('Daftar & Masuk');
    await tester.ensureVisible(submit);
    await tester.pumpAndSettle();
    await tester.tap(submit);
    await tester.pumpAndSettle();

    expect(find.textContaining('sudah terdaftar'), findsOneWidget);
    expect(find.text('Daftar Akun'), findsOneWidget);
  });

  testWidgets('konfirmasi kata sandi berbeda ditolak sebelum ke server',
      (tester) async {
    final devices = FakeDeviceRepository();
    await openRegister(
      tester,
      auth: FakeAuthRepository(),
      devices: devices,
    );

    await tester.enterText(find.byType(TextField).at(0), 'Budi Baru');
    await tester.enterText(find.byType(TextField).at(1), 'budi@rs.test');
    await tester.enterText(find.byType(TextField).at(4), 'Password123!');
    await tester.enterText(find.byType(TextField).at(5), 'Password124!');
    final Finder submit = find.text('Daftar & Masuk');
    await tester.ensureVisible(submit);
    await tester.pumpAndSettle();
    await tester.tap(submit);
    await tester.pumpAndSettle();

    expect(find.text('Konfirmasi kata sandi tidak sama.'), findsOneWidget);
    expect(devices.registerCalls, 0);
  });
}
