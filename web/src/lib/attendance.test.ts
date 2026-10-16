import { describe, expect, it } from 'vitest';
import { riskBadgeClass, toAttendanceQueryString } from './attendance';

describe('toAttendanceQueryString', () => {
  it('drops empties and defaults', () => {
    expect(toAttendanceQueryString({})).toBe('');
    expect(toAttendanceQueryString({ page: 1, search: '  ' })).toBe('');
  });

  it('serializes admin filters', () => {
    expect(
      toAttendanceQueryString({ page: 2, search: 'siti', needsReview: true, riskCategory: 'MEDIUM' }),
    ).toBe('?page=2&search=siti&riskCategory=MEDIUM&needsReview=true');
  });
});

describe('riskBadgeClass', () => {
  it('maps categories to distinct styles', () => {
    const low = riskBadgeClass('LOW');
    const med = riskBadgeClass('MEDIUM');
    const high = riskBadgeClass('HIGH');
    expect(new Set([low, med, high]).size).toBe(3);
    // Clinical triage tiers from the design system.
    expect(low).toContain('success');
    expect(med).toContain('warning');
    expect(high).toContain('danger');
    expect(riskBadgeClass(undefined)).toContain('surface-container');
  });
});
