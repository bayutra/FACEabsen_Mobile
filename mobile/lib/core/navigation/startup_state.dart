import 'package:flutter/widgets.dart';

enum StartupState { loading, authenticated, login, error }

StartupState resolveStartupState(AsyncSnapshot<bool> snap) {
  if (snap.hasError) return StartupState.error;
  if (!snap.hasData) return StartupState.loading;
  return snap.data == true ? StartupState.authenticated : StartupState.login;
}
