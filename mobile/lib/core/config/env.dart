// STEP 1 — Environment config (Mobile)
// Run with: flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1 --dart-define=APP_NAME="Face ID Attendance"
class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );
  static const appName = String.fromEnvironment(
    'APP_NAME',
    defaultValue: 'Face ID Attendance',
  );
}
