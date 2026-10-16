import { describe, expect, it } from 'vitest';
import { toReportPath } from './reports';

describe('toReportPath', () => {
  it('builds kind-specific paths', () => {
    expect(toReportPath({ kind: 'daily', date: '2026-10-05' })).toBe(
      '/api/reports/daily?date=2026-10-05',
    );
    expect(toReportPath({ kind: 'monthly', month: '2026-10' })).toBe(
      '/api/reports/monthly?month=2026-10',
    );
    expect(toReportPath({ kind: 'employee', employeeId: 'e1', from: '2026-10-01', to: '2026-10-31' })).toBe(
      '/api/reports/employee/e1?from=2026-10-01&to=2026-10-31',
    );
    expect(toReportPath({ kind: 'late' })).toBe('/api/reports/late');
  });
});
