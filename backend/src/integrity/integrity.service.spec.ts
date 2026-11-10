import { describe, expect, it } from 'vitest';
import { createHmac, generateKeyPairSync, sign, createVerify } from 'node:crypto';
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
      provider: 'unsigned',
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
      provider: 'hmac',
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
    expect(svc.verify(signedToken(good(), 'wrong-secret'), 'ANDROID')).toMatchObject({
      ok: false,
      reason: 'UNVERIFIED_SIGNATURE',
      signatureVerified: false,
      provider: 'hmac',
    });
    const tampered = signedToken(good()).replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    expect(svc.verify(tampered, 'ANDROID')).toMatchObject({
      ok: false,
      reason: 'UNVERIFIED_SIGNATURE',
      provider: 'hmac',
    });
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
      provider: 'hmac',
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
    ).toEqual({ ok: false, reason: 'EXPIRED', signatureVerified: true, provider: 'hmac' });
    expect(
      svc.verify(
        signedToken({
          ...good(),
          packageName: 'com.evil.clone',
        }),
        'ANDROID',
      ),
    ).toEqual({ ok: false, reason: 'WRONG_PACKAGE', signatureVerified: true, provider: 'hmac' });
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
      provider: 'hmac',
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
    expect(prod.verify(unsignedToken(good()), 'ANDROID')).toMatchObject({
      ok: false,
      reason: 'UNVERIFIED_SIGNATURE',
      provider: 'unsigned',
    });
  });

  it('verifies Android Play Integrity via decode API when enabled (provider penuh)', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const fetchMock = async (url: string, init?: any) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'g-access', expires_in: 3600 }),
          text: async () => '',
        } as any;
      }
      if (String(url).includes('playintegrity.googleapis.com/v1/com.rs.face_absen:decodeIntegrityToken')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.integrityToken).toBe('opaque-play-token');
        expect(init?.headers?.authorization).toBe('Bearer g-access');
        return {
          ok: true,
          json: async () => ({
            tokenPayloadExternal: {
              requestDetails: {
                requestPackageName: 'com.rs.face_absen',
                nonce: 'nonce-123',
              },
              appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
              deviceIntegrity: {
                deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'],
              },
            },
          }),
          text: async () => '',
        } as any;
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    try {
      const svc = new IntegrityService(
        cfg({
          ANDROID_PACKAGE_NAME: 'com.rs.face_absen',
          PLAY_INTEGRITY_ENABLED: 'true',
          PLAY_INTEGRITY_PROJECT_ID: 'p',
          PLAY_INTEGRITY_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
          PLAY_INTEGRITY_PRIVATE_KEY: pem,
        }),
      );
      const res = await svc.verifyAsync('opaque-play-token', 'ANDROID', { nonce: 'nonce-123' });
      expect(res.verdict).toMatchObject({
        ok: true,
        signatureVerified: true,
        provider: 'play_integrity',
      });

      const badNonce = await svc.verifyAsync('opaque-play-token', 'ANDROID', { nonce: 'wrong' });
      expect(badNonce.verdict).toMatchObject({
        ok: false,
        reason: 'NONCE_MISMATCH',
        provider: 'play_integrity',
      });
    } finally {
      (globalThis as any).fetch = orig;
    }
  });

  it('verifies iOS Apple-signed JWS via JWKS (provider penuh)', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = publicKey.export({ format: 'jwk' }) as any;
    jwk.kid = 'kid-1';
    jwk.alg = 'ES256';
    jwk.use = 'sig';

    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'kid-1', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      bundleId: 'com.rs.faceAbsen',
      exp: Math.floor(Date.now() / 1000) + 600,
      iss: 'https://devicecheck.apple.com',
    })).toString('base64url');
    const data = Buffer.from(`${header}.${payload}`);
    const signer = createHmac('sha256', 'x'); // dummy not used
    void signer; void sign; void createVerify;
    const sigBuf = (await import('node:crypto')).sign('sha256', data, { key: privateKey, dsaEncoding: 'ieee-p1363' });
    const token = `${header}.${payload}.${sigBuf.toString('base64url')}`;

    const fetchMock = async (url: string) => {
      if (String(url).includes('apple-jwks.test/keys')) {
        return {
          ok: true,
          json: async () => ({ keys: [jwk] }),
          text: async () => '',
        } as any;
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    try {
      const svc = new IntegrityService(
        cfg({
          IOS_BUNDLE_ID: 'com.rs.faceAbsen',
          APPLE_ATTEST_JWKS_URL: 'https://apple-jwks.test/keys',
        }),
      );
      const res = await svc.verifyAsync(token, 'IOS');
      expect(res.verdict).toMatchObject({
        ok: true,
        signatureVerified: true,
        provider: 'apple_app_attest',
      });
    } finally {
      (globalThis as any).fetch = orig;
    }
  });
});
