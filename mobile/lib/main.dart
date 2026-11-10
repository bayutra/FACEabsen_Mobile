import 'package:flutter/material.dart';

import 'app.dart';
import 'core/storage/secure_store.dart';
import 'features/notifications/data/push_notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Migrasi eksplisit storage lama (identitas perangkat & antrean akun)
  // sebelum UI berjalan agar skema scope baru tidak kehilangan data.
  await SecureStore().migrateLegacyStorage();
  // Aman bila google-services.json belum diganti: push dinonaktifkan dan
  // aplikasi tetap berjalan normal.
  await PushNotificationService.bootstrapFirebase();
  runApp(const App());
}
