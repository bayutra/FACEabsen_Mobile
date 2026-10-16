/**
 * Numeric config bounds (M13). Validates raw string env at boot (ConfigModule
 * `validate` hook). Missing vars fall back to the same defaults the services
 * use, so local dev with a bare .env still boots.
 */
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

  const geoAcc = num('GEO_MAX_ACCURACY_M', 50);
  if (!(geoAcc > 0)) {
    throw new Error('GEO_MAX_ACCURACY_M must be > 0');
  }

  const geoSkew = num('GEO_MAX_SKEW_MIN', 5);
  if (!(geoSkew > 0)) {
    throw new Error('GEO_MAX_SKEW_MIN must be > 0');
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
    num('RISK_W_FACE', 30),
    num('RISK_W_LIVENESS', 20),
    num('RISK_W_DEVICE', 15),
    num('RISK_W_INTEGRITY', 10),
    num('RISK_W_GPS', 10),
    num('RISK_W_GEOFENCE', 10),
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
}
