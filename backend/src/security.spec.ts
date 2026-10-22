import { describe, expect, it } from 'vitest';
import { assertProductionEnv } from './security.js';

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
    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        DATABASE_URL: 'postgresql://x',
        DATA_ENCRYPTION_KEY: goodKey,
      }),
    ).not.toThrow();
    expect(() =>
      assertProductionEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        DATABASE_URL: 'postgresql://x',
        DATA_ENCRYPTION_KEY: 'not-base64-32-bytes!!',
      }),
    ).toThrow('DATA_ENCRYPTION_KEY');
  });
});
