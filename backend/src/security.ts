import { AUTH_POLICY } from './auth/constants.js';

export interface EnvLike {
  NODE_ENV?: string;
  JWT_ACCESS_SECRET?: string;
  DATABASE_URL?: string;
  DATA_ENCRYPTION_KEY?: string;
  HOSPITAL_TZ?: string;
}

/**
 * STEP 22 — fail-closed production boot (PRD §67). Weak/default secrets must
 * never reach production. Pure + unit-tested.
 */
export function assertProductionEnv(env: EnvLike): void {
  if (env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  const secret = env.JWT_ACCESS_SECRET ?? '';
  if (!secret || secret === 'dev-only-secret' || secret === 'change-me-in-production-min-32-chars') {
    problems.push('JWT_ACCESS_SECRET is missing or still a placeholder');
  } else if (secret.length < AUTH_POLICY.jwtMinSecretLength) {
    problems.push(`JWT_ACCESS_SECRET must be at least ${AUTH_POLICY.jwtMinSecretLength} chars`);
  }
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is missing');
  const key = env.DATA_ENCRYPTION_KEY ?? '';
  if (!key || Buffer.from(key, 'base64').length !== 32) {
    problems.push('DATA_ENCRYPTION_KEY must be base64 of 32 bytes');
  }
  if (env.HOSPITAL_TZ) {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: env.HOSPITAL_TZ }).format(new Date());
    } catch {
      problems.push(`HOSPITAL_TZ is not a valid IANA time zone: ${env.HOSPITAL_TZ}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Refusing production boot:\n- ${problems.join('\n- ')}`);
  }
}
