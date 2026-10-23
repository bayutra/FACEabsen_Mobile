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
  const rawB64 = publicKey
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('base64');
  const msg = buildSignMessage('req-1', '2026-10-05T07:00:00.000Z');

  it('valid verifies; tampered/garbage rejected', () => {
    expect(msg).toBe('req-1.2026-10-05T07:00:00.000Z');
    const sig = sign(null, Buffer.from(msg, 'utf8'), privateKey).toString(
      'base64',
    );
    expect(verifyDeviceSignature(rawB64, msg, sig)).toBe(true);
    expect(verifyDeviceSignature(rawB64, msg + 'x', sig)).toBe(false);
    expect(verifyDeviceSignature(rawB64, msg, 'not-base64!!!')).toBe(false);
    expect(verifyDeviceSignature('short', msg, sig)).toBe(false);
  });
});

describe('validateLiveness', () => {
  const now = new Date('2026-10-05T07:00:00.000Z');
  const att = {
    passed: true,
    challenges: ['blink'],
    completedAt: now.toISOString(),
  };

  it('pass / stale / failed / empty', () => {
    expect(validateLiveness(att, now, 10)).toEqual({ ok: true });
    expect(
      validateLiveness(
        {
          ...att,
          completedAt: new Date(now.getTime() - 20 * 60_000).toISOString(),
        },
        now,
        10,
      ),
    ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
    expect(validateLiveness({ ...att, passed: false }, now, 10)).toEqual({
      ok: false,
      reason: 'LIVENESS_FAILED',
    });
    expect(validateLiveness({ ...att, challenges: [] }, now, 10)).toEqual({
      ok: false,
      reason: 'LIVENESS_EMPTY',
    });
  });

  describe('passive (Face-ID style) attestations', () => {
    const passive = {
      passed: true,
      mode: 'passive',
      padScore: 0.82,
      completedAt: now.toISOString(),
    };

    it('accepts a passive run that reports an anti-spoofing confidence', () => {
      expect(validateLiveness(passive, now, 10)).toEqual({ ok: true });
    });

    it('rejects an unknown mode rather than silently treating it as active', () => {
      expect(
        validateLiveness({ ...passive, mode: 'trust-me' }, now, 10),
      ).toEqual({
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
      expect(validateLiveness(noScore, now, 10)).toEqual({
        ok: false,
        reason: 'LIVENESS_EMPTY',
      });
    });

    it('still rejects a failed or stale passive run', () => {
      expect(validateLiveness({ ...passive, passed: false }, now, 10)).toEqual({
        ok: false,
        reason: 'LIVENESS_FAILED',
      });
      expect(
        validateLiveness(
          {
            ...passive,
            completedAt: new Date(now.getTime() - 20 * 60_000).toISOString(),
          },
          now,
          10,
        ),
      ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
    });

    it('the declared mode governs, not the challenge list', () => {
      expect(validateLiveness({ ...passive, challenges: [] }, now, 10)).toEqual(
        { ok: true },
      );
      expect(
        validateLiveness({ ...passive, challenges: ['blink'] }, now, 10),
      ).toEqual({ ok: true });
      const noScore = {
        passed: true,
        mode: 'passive',
        challenges: ['blink'],
        completedAt: now.toISOString(),
      };
      expect(validateLiveness(noScore, now, 10)).toEqual({
        ok: false,
        reason: 'LIVENESS_EMPTY',
      });
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
    const { date, key } = hospitalWorkDate(
      new Date('2026-10-12T23:30:00.000Z'),
      'Asia/Jakarta',
    );
    expect(key).toBe('2026-10-13');
    expect(date.toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });

  it('assertTimeZone fails fast on typos', () => {
    expect(() => assertTimeZone('Asia/Jakarta')).not.toThrow();
    expect(() => assertTimeZone('Jakarta')).toThrow('Invalid HOSPITAL_TZ');
  });
});

import {
  buildSignMessageV1,
  canonicalEmbedding,
  canonicalLiveness,
  validatePunchTime,
} from './helpers.js';

const liveness = {
  passed: true,
  mode: 'active' as const,
  completedAt: '2026-10-23T07:00:00.000Z',
  score: 0.987654321,
  padScore: 0.5,
  challenges: ['blink', 'turn_left'],
};

describe('signature v1', () => {
  it('memformat embedding 6 desimal', () => {
    expect(canonicalEmbedding([0.1, -0.25, 0.3333333333])).toBe(
      '0.100000,-0.250000,0.333333',
    );
  });

  it('memformat liveness deterministik', () => {
    expect(canonicalLiveness(liveness)).toBe(
      'mode:active|passed:1|completedAt:2026-10-23T07:00:00.000Z|score:0.987654|padScore:0.500000|challenges:blink,turn_left',
    );
  });

  it('membangun pesan v1 persis', () => {
    expect(
      buildSignMessageV1({
        action: 'check-in',
        deviceId: 'd1',
        requestId: '11111111-2222-3333-4444-555555555555',
        captureAt: '2026-10-23T07:00:00.000Z',
        nonce: 'nonce-abc',
        faceEmbedding: [0.1, -0.25, 0.3333333333],
        liveness,
      }),
    ).toBe(
      'v1|check-in|d1|11111111-2222-3333-4444-555555555555|2026-10-23T07:00:00.000Z||nonce-abc|666a0811ed27009b72350c48071862ff9228939118c89672bc349194caef88fb|b019db2a3f847f4fc92123aaf7f1b77be6e5dd9a1ef9f1311a02d30bd0cde14f',
    );
  });
});

describe('validatePunchTime', () => {
  const NOW = new Date('2026-10-23T08:00:00.000Z');
  const at = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();
  it('online 9 menit', () => {
    expect(
      validatePunchTime({
        captureAt: at(9 * 60_000),
        livenessCompletedAt: at(9 * 60_000),
        now: NOW,
        maxOnlineAgeMin: 10,
        maxOfflineAgeHours: 24,
      }),
    ).toEqual({ ok: true, offline: false });
  });
  it('online 11 menit', () => {
    expect(
      validatePunchTime({
        captureAt: at(11 * 60_000),
        livenessCompletedAt: at(11 * 60_000),
        now: NOW,
        maxOnlineAgeMin: 10,
        maxOfflineAgeHours: 24,
      }),
    ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
  });
  it('offline 23 jam', () => {
    expect(
      validatePunchTime({
        captureAt: at(23 * 3600_000),
        livenessCompletedAt: at(23 * 3600_000),
        queuedAt: at(2 * 3600_000),
        now: NOW,
        maxOnlineAgeMin: 10,
        maxOfflineAgeHours: 24,
      }),
    ).toEqual({ ok: true, offline: true });
  });
  it('offline 25 jam', () => {
    expect(
      validatePunchTime({
        captureAt: at(25 * 3600_000),
        livenessCompletedAt: at(25 * 3600_000),
        queuedAt: at(2 * 3600_000),
        now: NOW,
        maxOnlineAgeMin: 10,
        maxOfflineAgeHours: 24,
      }),
    ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
  });
  it('capture future 3 min', () => {
    expect(
      validatePunchTime({
        captureAt: at(-3 * 60_000),
        livenessCompletedAt: at(0),
        now: NOW,
        maxOnlineAgeMin: 10,
        maxOfflineAgeHours: 24,
      }),
    ).toEqual({ ok: false, reason: 'CAPTURE_IN_FUTURE' });
  });
  it('queued before capture', () => {
    expect(
      validatePunchTime({
        captureAt: at(2 * 3600_000),
        livenessCompletedAt: at(2 * 3600_000),
        queuedAt: at(3 * 3600_000),
        now: NOW,
        maxOnlineAgeMin: 10,
        maxOfflineAgeHours: 24,
      }),
    ).toEqual({ ok: false, reason: 'QUEUED_TIME_INVALID' });
  });
});
