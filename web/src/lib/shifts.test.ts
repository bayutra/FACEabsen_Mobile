import { describe, expect, it } from 'vitest';
import { formatWindow, toScheduleQueryString } from './shifts';

describe('formatWindow', () => {
  it('marks overnight spans', () => {
    expect(formatWindow({ startTime: '07:00', endTime: '15:00', overnight: false })).toBe(
      '07:00 → 15:00',
    );
    expect(formatWindow({ startTime: '23:00', endTime: '07:00', overnight: true })).toBe(
      '23:00 → 07:00 (+1 hari)',
    );
  });
});

describe('toScheduleQueryString', () => {
  it('drops empties', () => {
    expect(toScheduleQueryString({})).toBe('');
    expect(
      toScheduleQueryString({ from: '2026-09-01', to: '2026-09-30' }),
    ).toBe('?from=2026-09-01&to=2026-09-30');
  });
});
