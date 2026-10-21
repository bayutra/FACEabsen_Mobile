import 'package:face_absen_mobile/features/auth/presentation/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

// STEP 23 â€” login UI flow with faked repositories (no network/plugins).
void main() {
  testWidgets('successful login registers device and calls onDone', (tester) async {
    var done = false;
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(),
          devices: FakeDeviceRepository(),
          onDone: () => done = true,
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'karyawan@rs.test');
    await tester.enterText(find.byType(TextField).at(1), 'Password123!');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    expect(done, isTrue);
  });

  testWidgets('device registration failure still opens dashboard', (tester) async {
    var done = false;
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(),
          devices: FakeDeviceRepository(failRegister: true),
          onDone: () => done = true,
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'karyawan@rs.test');
    await tester.enterText(find.byType(TextField).at(1), 'Password123!');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    expect(done, isTrue);
  });

  testWidgets('tapping Daftar opens the registration screen', (tester) async {
    // Layar uji default 600px membuat tautan tertutup footer sticky.
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(),
          devices: FakeDeviceRepository(),
          onDone: () {},
        ),
      ),
    );

    await tester.tap(find.text('Daftar'));
    await tester.pumpAndSettle();

    expect(find.text('Daftar Akun'), findsOneWidget);
    expect(find.text('Daftar & Masuk'), findsOneWidget);
  });

  testWidgets('wrong credentials show Indonesian error', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(failLogin: true),
          devices: FakeDeviceRepository(),
          onDone: () {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'x@rs.test');
    await tester.enterText(find.byType(TextField).at(1), 'salah');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    expect(find.text('Kredensial atau kata sandi tidak sesuai.'), findsOneWidget);
  });

  testWidgets('offline server shows connection error (PRD offline)', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(failConnection: true),
          devices: FakeDeviceRepository(),
          onDone: () {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'x@rs.test');
    await tester.enterText(find.byType(TextField).at(1), 'apaaja');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    expect(find.textContaining('tidak terjangkau'), findsOneWidget);
  });

  testWidgets('TOTP challenge swaps to code step and completes login', (tester) async {
    var done = false;
    final devices = FakeDeviceRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(challengeTotp: true),
          devices: devices,
          onDone: () => done = true,
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'karyawan@rs.test');
    await tester.enterText(find.byType(TextField).at(1), 'Password123!');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    // Langkah kedua menggantikan form kredensial.
    expect(find.text('Verifikasi Dua Langkah'), findsOneWidget);
    expect(find.text('ID Karyawan / Email / NIP *'), findsNothing);
    expect(done, isFalse);

    await tester.enterText(find.byType(TextField), '123456');
    await tester.tap(find.text('Verifikasi'));
    await tester.pumpAndSettle();

    expect(done, isTrue);
    expect(devices.registerCalls, 1);
  });

  testWidgets('wrong TOTP code shows error and stays on code step', (tester) async {
    var done = false;
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(challengeTotp: true, failTotp: true),
          devices: FakeDeviceRepository(),
          onDone: () => done = true,
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'karyawan@rs.test');
    await tester.enterText(find.byType(TextField).at(1), 'Password123!');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '000000');
    await tester.tap(find.text('Verifikasi'));
    await tester.pumpAndSettle();

    expect(find.text('Kredensial atau kata sandi tidak sesuai.'), findsOneWidget);
    expect(find.text('Verifikasi Dua Langkah'), findsOneWidget);
    expect(done, isFalse);
  });

  testWidgets('recovery code path completes login', (tester) async {
    var done = false;
    final devices = FakeDeviceRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: FakeAuthRepository(challengeTotp: true),
          devices: devices,
          onDone: () => done = true,
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'karyawan@rs.test');
    await tester.enterText(find.byType(TextField).at(1), 'Password123!');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Pakai kode pemulihan'));
    await tester.pumpAndSettle();
    expect(find.text('Kode Pemulihan *'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'ABCD-EFGHIJ');
    await tester.tap(find.text('Verifikasi'));
    await tester.pumpAndSettle();

    expect(done, isTrue);
    expect(devices.registerCalls, 1);
  });
}
