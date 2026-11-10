import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { IntegrityService } from './integrity.service.js';

const cfg = (over: Record<string, unknown> = {}) =>
  ({ get: (k: string, d: unknown) => (k in over ? over[k] : d) }) as never;

const SECRET = 'test-integrity-secret-32-chars-minimum';

function b64url(o: object | string): string {
  const buf = typeof o === 'string' ? Buffer.from(o) : Buffer.from(JSON.stringify(o));
  return buf.toString('base64url');
}

function signedToken(payload: object, secret = SECRET): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function unsignedToken(payload: object): string {
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`;
}

const good = (over: Record<string, unknown> = {}) => ({
  packageName: 'com.rs.face_absen',
  exp: Math.floor(Date.now() / 1000) + 600,
  deviceIntegrity: { deviceVerdict: ['MEETS_DEVICE_INTEGRITY'] },
  appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
  ...over,
});

describe('IntegrityService', () => {
  it('rejects provided token when signature cannot be verified (fail-closed)', () => {
    const svc = new IntegrityService(
      cfg({ ANDROID_PACKAGE_NAME: 'com.rs.face_absen' }),
    );
    expect(svc.verify(unsignedToken(good()), 'ANDROID')).toEqual({
      ok: false,
      reason: 'UNVERIFIED_SIGNATURE',
      signatureVerified: false,
    });
  });

  it('accepts a cryptographically verified trusted token', () => {
    const svc = new IntegrityService(
      cfg({
        ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
        INTEGRITY_TOKEN_SECRET: SECRET,
      }),
    );
    expect(svc.verify(signedToken(good()), 'ANDROID')).toEqual({
      ok: true,
      signatureVerified: true,
    });

    expect(
      svc.verify(
        signedToken(good({ appIntegrity: ['PLAY_RECOGNIZED'] })),
        'ANDROID',
      ).ok,
    ).toBe(true);
  });

  it('rejects token with wrong or tampered signature', () => {
    const svc = new IntegrityService(
      cfg({
        ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
        INTEGRITY_TOKEN_SECRET: SECRET,
      }),
    );
    expect(svc.verify(signedToken(good(), 'wrong-secret'), 'ANDROID').reason).toBe(
      'UNVERIFIED_SIGNATURE',
    );
    const tampered = signedToken(good()).replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    expect(svc.verify(tampered, 'ANDROID').reason).toBe('UNVERIFIED_SIGNATURE');
  });

  it('rejects untrusted device verdict', () => {
    const svc = new IntegrityService(
      cfg({
        ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
        INTEGRITY_TOKEN_SECRET: SECRET,
      }),
    );
    const t = signedToken({
      packageName: 'com.rs.face_absen',
      deviceIntegrity: { deviceVerdict: ['MEETS_BASIC_INTEGRITY'] },
      appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    expect(svc.verify(t, 'ANDROID')).toEqual({
      ok: false,
      reason: 'DEVICE_NOT_TRUSTED',
      signatureVerified: true,
    });
  });

  it('rejects expired + malformed + wrong package', () => {
    const svc = new IntegrityService(
      cfg({
        ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
        INTEGRITY_TOKEN_SECRET: SECRET,
      }),
    );
    expect(svc.verify('not-a-jwt', 'ANDROID')).toEqual({
      ok: false,
      reason: 'MALFORMED',
      signatureVerified: false,
    });
    expect(
      svc.verify(signedToken({ ...good(), exp: 1 }), 'ANDROID'),
    ).toEqual({ ok: false, reason: 'EXPIRED', signatureVerified: true });
    expect(
      svc.verify(
        signedToken({
          ...good(),
          packageName: 'com.evil.clone',
        }),
        'ANDROID',
      ),
    ).toEqual({ ok: false, reason: 'WRONG_PACKAGE', signatureVerified: true });
  });

  it('fail-closed gaps: missing exp, missing verdicts, forged package', () => {
    const svc = new IntegrityService(
      cfg({
        ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
        INTEGRITY_TOKEN_SECRET: SECRET,
      }),
    );

    expect(
      svc.verify(signedToken(good({ exp: undefined })), 'ANDROID').reason,
    ).toBe('EXPIRED');

    const { deviceIntegrity: _d, ...noDevice } = good();
    expect(svc.verify(signedToken(noDevice), 'ANDROID').reason).toBe(
      'DEVICE_NOT_TRUSTED',
    );
    const { appIntegrity: _a, ...noApp } = good();
    expect(svc.verify(signedToken(noApp), 'ANDROID').reason).toBe(
      'APP_NOT_RECOGNIZED',
    );

    expect(
      svc.verify(signedToken(good({ packageName: undefined })), 'ANDROID')
        .reason,
    ).toBe('WRONG_PACKAGE');
  });

  it('rejects iOS token with missing verdict claims (fail-closed)', () => {
    const svc = new IntegrityService(
      cfg({ IOS_BUNDLE_ID: 'com.rs.faceAbsen', INTEGRITY_TOKEN_SECRET: SECRET }),
    );
    const base = {
      bundleId: 'com.rs.faceAbsen',
      exp: Math.floor(Date.now() / 1000) + 600,
      deviceIntegrity: ['MEETS_DEVICE_INTEGRITY'],
      appIntegrity: ['PLAY_RECOGNIZED'],
    };
    expect(svc.verify(signedToken(base), 'IOS')).toEqual({
      ok: true,
      signatureVerified: true,
    });
    const { deviceIntegrity: _d, ...noDevice } = base as any;
    expect(svc.verify(signedToken(noDevice), 'IOS').reason).toBe(
      'DEVICE_NOT_TRUSTED',
    );
    const { appIntegrity: _a, ...noApp } = base as any;
    expect(svc.verify(signedToken(noApp), 'IOS').reason).toBe(
      'APP_NOT_RECOGNIZED',
    );
  });

  it('strict mode without a configured package rejects claimed tokens', () => {
    const strict = new IntegrityService(
      cfg({ INTEGRITY_STRICT: 'true', INTEGRITY_TOKEN_SECRET: SECRET }),
    );

    expect(strict.verify(signedToken(good()), 'ANDROID').reason).toBe(
      'WRONG_PACKAGE',
    );
  });

  it('strict mode requires token; lax mode still does not trust jailbreak claim alone', () => {
    const strict = new IntegrityService(cfg({ INTEGRITY_STRICT: 'true' }));
    expect(strict.resolveSignal({ deviceCompromised: false }).ok).toBe(false);
    const lax = new IntegrityService(cfg({ INTEGRITY_STRICT: 'false' }));
    expect(lax.resolveSignal({ deviceCompromised: false }).ok).toBe(false);
    expect(lax.resolveSignal({ deviceCompromised: true }).ok).toBe(false);
  });

  it('defaults to strict in production; explicit false is a pilot opt-out', () => {
    const prod = new IntegrityService(cfg({ NODE_ENV: 'production' }));
    expect(prod.strictMode).toBe(true);
    expect(prod.resolveSignal({ deviceCompromised: false }).ok).toBe(false);

    const dev = new IntegrityService(cfg({ NODE_ENV: 'development' }));
    expect(dev.strictMode).toBe(false);

    const pilot = new IntegrityService(
      cfg({ NODE_ENV: 'production', INTEGRITY_STRICT: 'false' }),
    );
    expect(pilot.strictMode).toBe(false);
  });

  it('allows unverified claims only as explicit non-production opt-in', () => {
    const dev = new IntegrityService(
      cfg({
        NODE_ENV: 'development',
        ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
        INTEGRITY_ALLOW_UNVERIFIED_CLAIMS: 'true',
      }),
    );
    expect(dev.verify(unsignedToken(good()), 'ANDROID')).toEqual({
      ok: true,
      signatureVerified: false,
    });

    const prod = new IntegrityService(
      cfg({
        NODE_ENV: 'production',
        ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
        INTEGRITY_ALLOW_UNVERIFIED_CLAIMS: 'true',
      }),
    );
    expect(prod.verify(unsignedToken(good()), 'ANDROID').reason).toBe(
      'UNVERIFIED_SIGNATURE',
    );
  });
});
