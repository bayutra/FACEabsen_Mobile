import { describe, expect, it } from 'vitest';
import { coordsValid, haversineM, validateFix } from './geo.math.js';

// RS Contoh (seed): -7.65, 112.23, radius 100m
const FENCE = { latitude: -7.65, longitude: 112.23, radiusM: 100 };
const OPTS = { maxAccuracyM: 50, maxSkewMin: 5 };
const NOW = new Date('2026-10-05T07:00:00.000Z');
const fix = (over: Record<string, unknown> = {}) => ({
  latitude: -7.65,
  longitude: 112.23,
  accuracyM: 10,
  timestamp: NOW,
  isMocked: false,
  ...over,
});

describe('haversineM', () => {
  it('zero for identical points; ~111m per 0.001° latitude', () => {
    expect(haversineM(-7.65, 112.23, -7.65, 112.23)).toBe(0);
    const d = haversineM(-7.65, 112.23, -7.649, 112.23);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });
});

describe('validateFix (PRD §15-§17)', () => {
  it('courtyard fix is inside', () => {
    const v = validateFix(fix(), FENCE, { ...OPTS, now: NOW });
    expect(v.inside).toBe(true);
    expect(v.distanceM).toBe(0);
    expect(v.checks).toEqual({ coordsValid: true, accuracyOk: true, timestampFresh: true });
  });

  it('200m away is outside with measured distance', () => {
    const v = validateFix(fix({ latitude: -7.6482 }), FENCE, { ...OPTS, now: NOW });
    expect(v.inside).toBe(false);
    expect(v.distanceM).toBeGreaterThan(150);
  });

  it('mock flag forces outside + mockSuspected (anti mock-location)', () => {
    const v = validateFix(fix({ isMocked: true }), FENCE, { ...OPTS, now: NOW });
    expect(v.inside).toBe(false);
    expect(v.mockSuspected).toBe(true);
  });

  it('stale timestamp rejected (anti replay)', () => {
    const v = validateFix(
      fix({ timestamp: new Date(NOW.getTime() - 10 * 60_000) }),
      FENCE,
      { ...OPTS, now: NOW },
    );
    expect(v.inside).toBe(false);
    expect(v.checks.timestampFresh).toBe(false);
  });

  it('poor accuracy rejected', () => {
    const v = validateFix(fix({ accuracyM: 500 }), FENCE, { ...OPTS, now: NOW });
    expect(v.inside).toBe(false);
    expect(v.checks.accuracyOk).toBe(false);
  });

  it('null-island and out-of-range coords invalid', () => {
    expect(coordsValid(0, 0)).toBe(false);
    expect(coordsValid(91, 0)).toBe(false);
    expect(coordsValid(-7.65, 112.23)).toBe(true);
    const v = validateFix(fix({ latitude: 0, longitude: 0 }), FENCE, { ...OPTS, now: NOW });
    expect(v.inside).toBe(false);
  });
});
