import 'package:flutter/widgets.dart';

/// First-frame routing decision for [BootstrapGate], extracted as a pure
/// helper so it is unit-testable without pumping the real repositories.
enum StartupState { loading, authenticated, login, error }

StartupState resolveStartupState(AsyncSnapshot<bool> snap) {
  if (snap.hasError) return StartupState.error;
  if (!snap.hasData) return StartupState.loading;
  return snap.data == true ? StartupState.authenticated : StartupState.login;
}
