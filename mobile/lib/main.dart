import 'package:flutter/material.dart';

import 'app.dart';
import 'features/notifications/data/push_notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Aman bila google-services.json belum diganti: push dinonaktifkan dan
  // aplikasi tetap berjalan normal.
  await PushNotificationService.bootstrapFirebase();
  runApp(const App());
}
