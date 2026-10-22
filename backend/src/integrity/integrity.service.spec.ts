import { describe, expect, it } from 'vitest';
import { IntegrityService } from './integrity.service.js';

const cfg = (over: Record<string, unknown> = {}) =>
  ({ get: (k: string, d: unknown) => (k in over ? over[k] : d) }) as never;

function token(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

const good = (over: Record<string, unknown> = {}) => ({
  packageName: 'com.rs.face_absen',
  exp: Math.floor(Date.now() / 1000) + 600,
  deviceIntegrity: { deviceVerdict: ['MEETS_DEVICE_INTEGRITY'] },
  appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
  ...over,
});

describe('IntegrityService', () => {
  it('accepts a trusted device+app verdict (genuine Play shapes)', () => {
    const svc = new IntegrityService(cfg({ ANDROID_PACKAGE_NAME: 'com.rs.face_absen' }));
    expect(svc.verify(token(good()), 'ANDROID')).toEqual({ ok: true, signatureVerified: false });
    
    expect(
      svc.verify(token(good({ appIntegrity: ['PLAY_RECOGNIZED'] })), 'ANDROID').ok,
    ).toBe(true);
  });

  it('rejects untrusted device verdict', () => {
    const svc = new IntegrityService(cfg());
    const t = token({
      deviceIntegrity: { deviceVerdict: ['MEETS_BASIC_INTEGRITY'] },
      appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    expect(svc.verify(t, 'ANDROID')).toEqual({
      ok: false,
      reason: 'DEVICE_NOT_TRUSTED',
      signatureVerified: false,
    });
  });

  it('rejects expired + malformed + wrong package', () => {
    const svc = new IntegrityService(cfg({ ANDROID_PACKAGE_NAME: 'com.rs.face_absen' }));
    expect(svc.verify('not-a-jwt', 'ANDROID')).toEqual({
      ok: false,
      reason: 'MALFORMED',
      signatureVerified: false,
    });
    expect(svc.verify(token({ exp: 1 }), 'ANDROID')).toEqual({
      ok: false,
      reason: 'EXPIRED',
      signatureVerified: false,
    });
    expect(svc.verify(token({ packageName: 'com.evil.clone', exp: Math.floor(Date.now() / 1000) + 600 }), 'ANDROID'))
      .toEqual({ ok: false, reason: 'WRONG_PACKAGE', signatureVerified: false });
  });

  it('fail-closed gaps (Tahap 3): missing exp, missing verdicts, forged token', () => {
    const svc = new IntegrityService(cfg({ ANDROID_PACKAGE_NAME: 'com.rs.face_absen' }));
    
    expect(svc.verify(token(good({ exp: undefined })), 'ANDROID').reason).toBe('EXPIRED');
    
    const { deviceIntegrity: _d, ...noDevice } = good();
    expect(svc.verify(token(noDevice), 'ANDROID').reason).toBe('DEVICE_NOT_TRUSTED');
    const { appIntegrity: _a, ...noApp } = good();
    expect(svc.verify(token(noApp), 'ANDROID').reason).toBe('APP_NOT_RECOGNIZED');
    
    expect(svc.verify(token(good({ packageName: undefined })), 'ANDROID').reason).toBe(
      'WRONG_PACKAGE',
    );
  });

  it('strict mode without a configured package rejects claimed tokens', () => {
    const strict = new IntegrityService(cfg({ INTEGRITY_STRICT: 'true' }));
    
    expect(strict.verify(token(good()), 'ANDROID').reason).toBe('WRONG_PACKAGE');
  });

  it('strict mode requires token; lax mode falls back to jailbreak claim', () => {
    const strict = new IntegrityService(cfg({ INTEGRITY_STRICT: 'true' }));
    expect(strict.resolveSignal({ deviceCompromised: false }).ok).toBe(false);
    const lax = new IntegrityService(cfg({ INTEGRITY_STRICT: 'false' }));
    expect(lax.resolveSignal({ deviceCompromised: false }).ok).toBe(true);
    expect(lax.resolveSignal({ deviceCompromised: true }).ok).toBe(false);
  });
});
