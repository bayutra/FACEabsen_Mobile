import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertTimeZone,
  buildSignMessage,
  cosineSimilarity,
  hospitalWorkDate,
  utcWorkDate,
  validateLiveness,
  verifyDeviceSignature,
} from './helpers.js';

describe('cosineSimilarity', () => {
  it('identical 1, orthogonal 0, opposite -1, empty -1', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 9);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 9);
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 9);
    expect(cosineSimilarity([], [])).toBe(-1);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(-1);
  });
});

describe('device signature (Ed25519)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawB64 = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
  const msg = buildSignMessage('req-1', '2026-10-05T07:00:00.000Z');

  it('valid verifies; tampered/garbage rejected', () => {
    expect(msg).toBe('req-1.2026-10-05T07:00:00.000Z');
    const sig = sign(null, Buffer.from(msg, 'utf8'), privateKey).toString('base64');
    expect(verifyDeviceSignature(rawB64, msg, sig)).toBe(true);
    expect(verifyDeviceSignature(rawB64, msg + 'x', sig)).toBe(false);
    expect(verifyDeviceSignature(rawB64, msg, 'not-base64!!!')).toBe(false);
    expect(verifyDeviceSignature('short', msg, sig)).toBe(false);
  });
});

describe('validateLiveness', () => {
  const now = new Date('2026-10-05T07:00:00.000Z');
  const att = { passed: true, challenges: ['blink'], completedAt: now.toISOString() };

  it('pass / stale / failed / empty', () => {
    expect(validateLiveness(att, now, 10)).toEqual({ ok: true });
    expect(
      validateLiveness({ ...att, completedAt: new Date(now.getTime() - 20 * 60_000).toISOString() }, now, 10),
    ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
    expect(validateLiveness({ ...att, passed: false }, now, 10)).toEqual({ ok: false, reason: 'LIVENESS_FAILED' });
    expect(validateLiveness({ ...att, challenges: [] }, now, 10)).toEqual({ ok: false, reason: 'LIVENESS_EMPTY' });
  });

  describe('passive (Face-ID style) attestations', () => {
    const passive = { passed: true, mode: 'passive', padScore: 0.82, completedAt: now.toISOString() };

    it('accepts a passive run that reports an anti-spoofing confidence', () => {
      expect(validateLiveness(passive, now, 10)).toEqual({ ok: true });
    });

    it('rejects an unknown mode rather than silently treating it as active', () => {
      expect(validateLiveness({ ...passive, mode: 'trust-me' }, now, 10)).toEqual({
        ok: false,
        reason: 'LIVENESS_MODE_UNSUPPORTED',
      });
    });

    it('rejects a passive claim with no confidence, so "passed" cannot be waved through', () => {
      expect(validateLiveness({ ...passive, padScore: 0 }, now, 10)).toEqual({
        ok: false,
        reason: 'LIVENESS_EMPTY',
      });
      const noScore: Record<string, unknown> = { ...passive };
      delete noScore.padScore;
      expect(validateLiveness(noScore, now, 10)).toEqual({ ok: false, reason: 'LIVENESS_EMPTY' });
    });

    it('still rejects a failed or stale passive run', () => {
      expect(validateLiveness({ ...passive, passed: false }, now, 10)).toEqual({
        ok: false,
        reason: 'LIVENESS_FAILED',
      });
      expect(
        validateLiveness(
          { ...passive, completedAt: new Date(now.getTime() - 20 * 60_000).toISOString() },
          now,
          10,
        ),
      ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
    });

    it('the declared mode governs, not the challenge list', () => {
      // An empty challenge array is fine in passive mode, and a populated one
      // does not let a passive claim skip the padScore requirement.
      expect(validateLiveness({ ...passive, challenges: [] }, now, 10)).toEqual({ ok: true });
      expect(validateLiveness({ ...passive, challenges: ['blink'] }, now, 10)).toEqual({ ok: true });
      const noScore = { passed: true, mode: 'passive', challenges: ['blink'], completedAt: now.toISOString() };
      expect(validateLiveness(noScore, now, 10)).toEqual({ ok: false, reason: 'LIVENESS_EMPTY' });
    });
  });
});

describe('utcWorkDate', () => {
  it('anchors midnight UTC key', () => {
    const { date, key } = utcWorkDate(new Date('2026-09-23T23:30:00.000Z'));
    expect(key).toBe('2026-09-23');
    expect(date.toISOString()).toBe('2026-09-23T00:00:00.000Z');
  });
});

describe('hospitalWorkDate', () => {
  it('resolves the hospital-local day but keeps the UTC-midnight storage convention', () => {
    // 23:30Z Oct 12 == 06:30 WIB Oct 13: the night-shift punch belongs to Oct 13.
    const { date, key } = hospitalWorkDate(new Date('2026-10-12T23:30:00.000Z'), 'Asia/Jakarta');
    expect(key).toBe('2026-10-13');
    expect(date.toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });

  it('assertTimeZone fails fast on typos', () => {
    expect(() => assertTimeZone('Asia/Jakarta')).not.toThrow();
    expect(() => assertTimeZone('Jakarta')).toThrow('Invalid HOSPITAL_TZ');
  });
});
