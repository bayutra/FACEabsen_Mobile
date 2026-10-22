import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/features/auth/data/auth_repository.dart';
import 'package:face_absen_mobile/features/auth/presentation/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fakes.dart';

class _SessionFakeAdapter implements HttpClientAdapter {
  Map<String, List<String>> get _json => {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      jsonEncode({
        'accessToken': 'access-123',
        'refreshToken': 'refresh-123',
        'user': {'id': 'u1', 'email': 'karyawan@rs.test'},
      }),
      200,
      headers: _json,
    );
  }

  @override
  void close({bool force = false}) {}
}

AuthRepository _repoWith(FakeStore store) {
  final Dio dio = Dio()..httpClientAdapter = _SessionFakeAdapter();
  return AuthRepository(dio: dio, store: store);
}

void main() {
  group('remember-me repository/store', () {
    test('checked (default) persists access + refresh', () async {
      final FakeStore store = FakeStore();
      await _repoWith(store).login(email: 'a@rs.test', password: 'pw');
      expect(await store.readAccessToken(), 'access-123');
      expect(await store.readRefreshToken(), 'refresh-123');
    });

    test('unchecked keeps access for this run but drops refresh', () async {
      final FakeStore store = FakeStore();
      await _repoWith(store).login(
        email: 'a@rs.test',
        password: 'pw',
        rememberMe: false,
      );

      expect(await store.readAccessToken(), 'access-123');

      expect(await store.readRefreshToken(), isNull);
    });

    test('TOTP second-factor paths honor rememberMe=false', () async {
      final FakeStore verifyStore = FakeStore();
      await _repoWith(verifyStore).verifyTotp(
        totpToken: 't',
        code: '123456',
        rememberMe: false,
      );
      expect(await verifyStore.readAccessToken(), 'access-123');
      expect(await verifyStore.readRefreshToken(), isNull);

      final FakeStore recoverStore = FakeStore();
      await _repoWith(recoverStore).recoverTotp(
        totpToken: 't',
        recoveryCode: 'ABCD-EFGHIJ',
        rememberMe: false,
      );
      expect(await recoverStore.readAccessToken(), 'access-123');
      expect(await recoverStore.readRefreshToken(), isNull);
    });

    test('logout clears everything regardless of rememberMe', () async {
      final FakeStore store = FakeStore();
      await _repoWith(store).login(
        email: 'a@rs.test',
        password: 'pw',
        rememberMe: false,
      );
      await _repoWith(store).logout();
      expect(await store.readAccessToken(), isNull);
      expect(await store.readRefreshToken(), isNull);
    });
  });

  group('remember-me login widget', () {
    Future<void> pumpLogin(
      WidgetTester tester,
      FakeAuthRepository auth, {
      required void Function() onDone,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            auth: auth,
            devices: FakeDeviceRepository(),
            onDone: onDone,
          ),
        ),
      );
    }

    Future<void> fillCredentials(WidgetTester tester) async {
      await tester.enterText(find.byType(TextField).at(0), 'karyawan@rs.test');
      await tester.enterText(find.byType(TextField).at(1), 'Password123!');
    }

    testWidgets('checked by default → login with rememberMe=true',
        (tester) async {
      final FakeAuthRepository auth = FakeAuthRepository();
      var done = false;
      await pumpLogin(tester, auth, onDone: () => done = true);

      expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isTrue);
      await fillCredentials(tester);
      await tester.tap(find.text('Masuk'));
      await tester.pumpAndSettle();

      expect(done, isTrue);
      expect(auth.lastRememberMe, isTrue);
    });

    testWidgets('unchecked → login with rememberMe=false', (tester) async {
      final FakeAuthRepository auth = FakeAuthRepository();
      var done = false;
      await pumpLogin(tester, auth, onDone: () => done = true);

      await fillCredentials(tester);
      await tester.tap(find.byType(Checkbox));
      await tester.pump();
      expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isFalse);

      await tester.tap(find.text('Masuk'));
      await tester.pumpAndSettle();

      expect(done, isTrue);
      expect(auth.lastRememberMe, isFalse);
    });

    testWidgets('TOTP completion honors unchecked rememberMe', (tester) async {
      final FakeAuthRepository auth = FakeAuthRepository(challengeTotp: true);
      var done = false;
      await pumpLogin(tester, auth, onDone: () => done = true);

      await fillCredentials(tester);
      await tester.tap(find.byType(Checkbox));
      await tester.pump();
      await tester.tap(find.text('Masuk'));
      await tester.pumpAndSettle();

      expect(find.text('Verifikasi Dua Langkah'), findsOneWidget);
      await tester.enterText(find.byType(TextField), '123456');
      await tester.tap(find.text('Verifikasi'));
      await tester.pumpAndSettle();

      expect(done, isTrue);
      expect(auth.lastRememberMe, isFalse);
    });
  });
}
