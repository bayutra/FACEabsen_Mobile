import { describe, expect, it } from 'vitest';
import { validateLiveness } from './liveness.js';

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
