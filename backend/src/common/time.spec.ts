import { describe, expect, it } from 'vitest';
import {
  assertTimeZone,
  hospitalWorkDate,
  timeOfDayInTimeZone,
  utcWorkDate,
  validatePunchTime,
} from './time.js';

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

describe('timeOfDayInTimeZone', () => {
  it('renders hospital-local wall clock instead of UTC', () => {
    // 01:29Z is 08:29 WIB — the exact value the mobile app shows.
    const at = new Date('2026-11-10T01:29:28.946Z');
    expect(timeOfDayInTimeZone(at, 'Asia/Jakarta')).toBe('08:29');
    expect(timeOfDayInTimeZone(at, 'UTC')).toBe('01:29');
  });

  it('never renders midnight as 24:00', () => {
    expect(
      timeOfDayInTimeZone(new Date('2026-11-09T17:00:00.000Z'), 'Asia/Jakarta'),
    ).toBe('00:00');
  });

  it('accepts ISO strings', () => {
    expect(
      timeOfDayInTimeZone('2026-11-10T01:29:28.946Z', 'Asia/Jakarta'),
    ).toBe('08:29');
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
