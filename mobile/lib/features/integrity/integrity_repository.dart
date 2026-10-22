import 'dart:io';

import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';

class IntegrityRepository {
  Future<String?> getToken() async {
    return null;
  }

  Future<bool> isCompromised() => FlutterJailbreakDetection.jailbroken;

  String get platform => Platform.isIOS ? 'IOS' : 'ANDROID';
}
