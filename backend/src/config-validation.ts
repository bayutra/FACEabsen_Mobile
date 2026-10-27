export function validateEnv(env: Record<string, unknown>): void {
  const num = (key: string, dflt: number): number => {
    const raw = env[key];
    if (raw === undefined || raw === null || raw === '') return dflt;
    return Number(raw);
  };

  const threshold = num('FACE_MATCH_THRESHOLD', 0.5);
  if (!(threshold > 0 && threshold <= 1)) {
    throw new Error('FACE_MATCH_THRESHOLD must be in (0, 1]');
  }

  const liveAge = num('LIVENESS_MAX_AGE_MIN', 10);
  if (!(liveAge > 0)) {
    throw new Error('LIVENESS_MAX_AGE_MIN must be > 0');
  }

  const reqSkew = num('REQUEST_MAX_SKEW_MIN', 5);
  if (!(reqSkew > 0)) {
    throw new Error('REQUEST_MAX_SKEW_MIN must be > 0');
  }

  const weights = [
    num('RISK_W_FACE', 45),
    num('RISK_W_LIVENESS', 20),
    num('RISK_W_DEVICE', 15),
    num('RISK_W_INTEGRITY', 15),
    num('RISK_W_SIGNATURE', 5),
  ];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || Math.abs(sum - 100) > 1e-6) {
    throw new Error('RISK_W_* weights must sum to 100');
  }

  const lowMin = num('RISK_LOW_MIN', 90);
  const medMin = num('RISK_MEDIUM_MIN', 70);
  if (!(lowMin > medMin)) {
    throw new Error('RISK_LOW_MIN must be greater than RISK_MEDIUM_MIN');
  }

  // Push notifications are optional. Either point the backend at the Firebase
  // service-account JSON, or supply the three split credential variables — a
  // half-configured setup would silently disable delivery, so fail fast.
  const str = (key: string): string => String(env[key] ?? '').trim();
  const hasServiceAccount = Boolean(
    str('FCM_SERVICE_ACCOUNT_PATH') || str('FCM_SERVICE_ACCOUNT_JSON'),
  );
  if (!hasServiceAccount) {
    const parts = ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'];
    const provided = parts.filter((key) => str(key));
    if (provided.length > 0 && provided.length < parts.length) {
      throw new Error(
        `FCM credentials are incomplete: set all of ${parts.join(', ')} (or FCM_SERVICE_ACCOUNT_PATH / FCM_SERVICE_ACCOUNT_JSON).`,
      );
    }
  }
  const fcmEnabled = str('FCM_ENABLED').toLowerCase();
  if (fcmEnabled && fcmEnabled !== 'true' && fcmEnabled !== 'false') {
    throw new Error('FCM_ENABLED must be "true" or "false"');
  }
}
