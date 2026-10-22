import { describe, expect, it } from 'vitest';
import {
  evaluateCheckIn,
  evaluateCheckOut,
  isOvernightRange,
  parseHHmm,
  shiftWindow,
  workDateKeyIn,
  type ShiftLike,
} from './shift-time.js';

const PAGI: ShiftLike = {
  startTime: '07:00',
  endTime: '15:00',
  overnight: false,
  gracePeriodMin: 15,
  lateThresholdMin: 30,
  earlyCheckoutThresholdMin: 15,
};


const MALAM: ShiftLike = {
  startTime: '23:00',
  endTime: '07:00',
  overnight: true,
  gracePeriodMin: 15,
  lateThresholdMin: 30,
  earlyCheckoutThresholdMin: 15,
};

describe('parseHHmm / isOvernightRange', () => {
  it('parses and rejects', () => {
    expect(parseHHmm('07:00')).toBe(420);
    expect(parseHHmm('23:59')).toBe(1439);
    expect(() => parseHHmm('24:00')).toThrow();
    expect(() => parseHHmm('7:00')).toThrow();
  });

  it('detects overnight ranges', () => {
    expect(isOvernightRange('07:00', '15:00')).toBe(false);
    expect(isOvernightRange('23:00', '07:00')).toBe(true);
  });
});

describe('shiftWindow', () => {
  it('day shift stays within the date', () => {
    const w = shiftWindow('2026-09-23', PAGI);
    expect(w.start.toISOString()).toBe('2026-09-23T07:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-09-23T15:00:00.000Z');
  });

  it('night shift 23:00 → 07:00 spans into the next day as ONE window', () => {
    const w = shiftWindow('2026-09-23', MALAM);
    expect(w.start.toISOString()).toBe('2026-09-23T23:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-09-24T07:00:00.000Z');
  });
});

describe('evaluateCheckIn (night shift)', () => {
  it('22:50 check-in for 23:00 shift is ON_TIME (early arrival)', () => {
    const r = evaluateCheckIn(new Date('2026-09-23T22:50:00.000Z'), '2026-09-23', MALAM);
    expect(r).toEqual({ status: 'ON_TIME', lateMinutes: 0 });
  });

  it('grace boundary 23:10 ON_TIME, 23:20 LATE, 23:45 VERY_LATE', () => {
    expect(evaluateCheckIn(new Date('2026-09-23T23:10:00Z'), '2026-09-23', MALAM).status).toBe('ON_TIME');
    expect(evaluateCheckIn(new Date('2026-09-23T23:20:00Z'), '2026-09-23', MALAM)).toEqual({
      status: 'LATE',
      lateMinutes: 20,
    });
    expect(evaluateCheckIn(new Date('2026-09-23T23:45:00Z'), '2026-09-23', MALAM).status).toBe('VERY_LATE');
  });
});

describe('evaluateCheckOut (night shift)', () => {
  it('07:05 next-day checkout is NORMAL, 06:30 is EARLY', () => {
    const normal = evaluateCheckOut(new Date('2026-09-24T07:05:00.000Z'), '2026-09-23', MALAM);
    expect(normal).toEqual({ status: 'NORMAL_CHECKOUT', earlyMinutes: 0 });
    
    const early = evaluateCheckOut(new Date('2026-09-24T06:30:00.000Z'), '2026-09-23', MALAM);
    expect(early).toEqual({ status: 'EARLY_CHECKOUT', earlyMinutes: 30 });
  });
});



describe('hospital timezone (Asia/Jakarta)', () => {
  const TZ = 'Asia/Jakarta';

  it('workDateKeyIn resolves the local calendar day', () => {
    
    expect(workDateKeyIn(new Date('2026-10-12T23:30:00.000Z'), TZ)).toBe('2026-10-13');
    expect(workDateKeyIn(new Date('2026-10-12T16:59:00.000Z'), TZ)).toBe('2026-10-12');
  });

  it('day shift anchors at 07:00 local (00:00Z)', () => {
    const w = shiftWindow('2026-10-13', PAGI, TZ);
    expect(w.start.toISOString()).toBe('2026-10-13T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-13T08:00:00.000Z');
  });

  it('06:55 WIB arrival is ON_TIME for the 07:00 shift (not NO_SCHEDULE)', () => {
    const r = evaluateCheckIn(new Date('2026-10-12T23:55:00.000Z'), '2026-10-13', PAGI, TZ);
    expect(r).toEqual({ status: 'ON_TIME', lateMinutes: 0 });
  });

  it('07:10 WIB is ON_TIME (grace), 07:20 WIB is LATE — not shifted by 7h', () => {
    expect(evaluateCheckIn(new Date('2026-10-13T00:10:00.000Z'), '2026-10-13', PAGI, TZ)).toEqual({
      status: 'ON_TIME',
      lateMinutes: 10,
    });
    expect(evaluateCheckIn(new Date('2026-10-13T00:20:00.000Z'), '2026-10-13', PAGI, TZ)).toEqual({
      status: 'LATE',
      lateMinutes: 20,
    });
  });

  it('night shift 23:00→07:00 WIB spans 16:00Z→00:00Z as ONE window', () => {
    const w = shiftWindow('2026-10-13', MALAM, TZ);
    expect(w.start.toISOString()).toBe('2026-10-13T16:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-14T00:00:00.000Z');
    
    expect(evaluateCheckIn(new Date('2026-10-13T16:10:00.000Z'), '2026-10-13', MALAM, TZ)).toEqual({
      status: 'ON_TIME',
      lateMinutes: 10,
    });
    expect(evaluateCheckIn(new Date('2026-10-13T16:30:00.000Z'), '2026-10-13', MALAM, TZ).status).toBe('LATE');
    expect(evaluateCheckOut(new Date('2026-10-13T23:55:00.000Z'), '2026-10-13', MALAM, TZ)).toEqual({
      status: 'NORMAL_CHECKOUT',
      earlyMinutes: 5,
    });
  });
});
