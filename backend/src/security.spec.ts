import { describe, expect, it } from 'vitest';
import { assertProductionEnv, requireJwtSecret } from './security.js';

describe('requireJwtSecret', () => {
  it('fails fast when the secret is missing, a placeholder, or too short', () => {
    expect(() => requireJwtSecret(undefined)).toThrow('required');
    expect(() => requireJwtSecret('   ')).toThrow('required');
    expect(() => requireJwtSecret('dev-only-secret')).toThrow('placeholder');
    expect(() =>
      requireJwtSecret('change-me-in-production-min-32-chars'),
    ).toThrow('placeholder');
    expect(() => requireJwtSecret('short-secret')).toThrow('at least 32 chars');
  });

  it('accepts a strong secret', () => {
    expect(requireJwtSecret('a'.repeat(32))).toBe('a'.repeat(32));
  });
});

describe('assertProductionEnv (STEP 22)', () => {
  it('non-production always boots', () => {
    expect(() => assertProductionEnv({})).not.toThrow();
    expect(() =>
      assertProductionEnv({ NODE_ENV: 'development' }),
    ).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('production refuses placeholder/weak/missing secrets', () => {
    expect(() => assertProductionEnv({ NODE_ENV: 'production' })).toThrow(
      'JWT_ACCESS_SECRET',
    );
    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev-only-secret',
      }),
    ).toThrow('placeholder');
    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'short-secret',
      }),
    ).toThrow('at least 32 chars');
  });

  it('production boots only with real secrets + DB + encryption key', () => {
    const goodKey = Buffer.alloc(32).toString('base64');
    const goodEnv = {
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      DATABASE_URL: 'postgresql://x',
      DATA_ENCRYPTION_KEY: goodKey,
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'no-reply@example.com',
      EMAIL_CODE_SECRET: 'b'.repeat(32),
    };
    expect(() => assertProductionEnv(goodEnv)).not.toThrow();
    expect(() =>
      assertProductionEnv({
        ...goodEnv,
        DATA_ENCRYPTION_KEY: 'not-base64-32-bytes!!',
      }),
    ).toThrow('DATA_ENCRYPTION_KEY');
  });
});
