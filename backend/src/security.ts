import { AUTH_POLICY } from './auth/constants.js';

export interface EnvLike {
  NODE_ENV?: string;
  JWT_ACCESS_SECRET?: string;
  DATABASE_URL?: string;
  DATA_ENCRYPTION_KEY?: string;
  HOSPITAL_TZ?: string;
  SMTP_HOST?: string;
  SMTP_FROM?: string;
  EMAIL_CODE_SECRET?: string;
}

export function assertProductionEnv(env: EnvLike): void {
  if (env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  const secret = env.JWT_ACCESS_SECRET ?? '';
  if (
    !secret ||
    secret === 'dev-only-secret' ||
    secret === 'change-me-in-production-min-32-chars'
  ) {
    problems.push('JWT_ACCESS_SECRET is missing or still a placeholder');
  } else if (secret.length < AUTH_POLICY.jwtMinSecretLength) {
    problems.push(
      `JWT_ACCESS_SECRET must be at least ${AUTH_POLICY.jwtMinSecretLength} chars`,
    );
  }
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is missing');
  const key = env.DATA_ENCRYPTION_KEY ?? '';
  if (!key || Buffer.from(key, 'base64').length !== 32) {
    problems.push('DATA_ENCRYPTION_KEY must be base64 of 32 bytes');
  }
  if (env.HOSPITAL_TZ) {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: env.HOSPITAL_TZ }).format(
        new Date(),
      );
    } catch {
      problems.push(
        `HOSPITAL_TZ is not a valid IANA time zone: ${env.HOSPITAL_TZ}`,
      );
    }
  }
  if (!env.SMTP_HOST) problems.push('SMTP_HOST is missing');
  if (!env.SMTP_FROM) problems.push('SMTP_FROM is missing');
  const ecs = env.EMAIL_CODE_SECRET ?? '';
  if (!ecs || ecs.length < 32) problems.push('EMAIL_CODE_SECRET must be at least 32 chars');
  if (problems.length) throw new Error(problems.join('; '));
}
