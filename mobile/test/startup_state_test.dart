import 'package:face_absen_mobile/core/navigation/startup_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// BootstrapGate routing without pumping the real repositories: offline at
/// launch surfaces `hasError`, which must map to the error panel — never to
/// the infinite spinner the old `!snap.hasData` check produced.
void main() {
  group('resolveStartupState', () {
    test('waiting tanpa data → loading', () {
      expect(
        resolveStartupState(const AsyncSnapshot<bool>.waiting()),
        StartupState.loading,
      );
    });

    test('error saat probe sesi (offline) → error', () {
      expect(
        resolveStartupState(
          AsyncSnapshot<bool>.withError(
              ConnectionState.done, Exception('Connection refused')),
        ),
        StartupState.error,
      );
    });

    test('selesai dengan sesi → authenticated', () {
      expect(
        resolveStartupState(
          const AsyncSnapshot<bool>.withData(ConnectionState.done, true),
        ),
        StartupState.authenticated,
      );
    });

    test('selesai tanpa sesi → login', () {
      expect(
        resolveStartupState(
          const AsyncSnapshot<bool>.withData(ConnectionState.done, false),
        ),
        StartupState.login,
      );
    });

    test('error mengalahkan data (edge AsyncSnapshot) → error', () {
      expect(
        resolveStartupState(
          const AsyncSnapshot<bool>.withError(ConnectionState.done, 'x'),
        ),
        StartupState.error,
      );
    });
  });
}
