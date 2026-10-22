class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );
  static const appName = String.fromEnvironment(
    'APP_NAME',
    defaultValue: 'Face Absen',
  );
}
