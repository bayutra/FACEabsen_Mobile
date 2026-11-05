import { describe, expect, it, vi } from 'vitest';
import type { ReportsService } from '../reports/reports.service.js';
import { DashboardSummaryService } from './dashboard-summary.service.js';

function makeReports(overrides: Record<string, unknown> = {}) {
  return {
    daily: vi.fn(async () => ({ report: { summary: [['Hadir', '1']] } })),
    countReview: vi.fn(async () => 3),
    countCorrections: vi.fn(async () => 2),
    countLeaves: vi.fn(async () => 1),
    countPendingDevices: vi.fn(async () => 4),
    listRecentAudit: vi.fn(async () => [
      { id: 'aud-1', action: 'LOGIN', result: 'SUCCESS' },
    ]),
    ...overrides,
  } as unknown as ReportsService;
}

describe('DashboardSummaryService', () => {
  it('aggregates report and queue counts in one call', async () => {
    const reports = makeReports();
    const svc = new DashboardSummaryService(reports);
    const out = await svc.summary('2026-10-05', 'u-sup', ['SUPERVISOR']);

    expect(out.date).toBe('2026-10-05');
    expect(out.report).toEqual({ summary: [['Hadir', '1']] });
    expect(out.review).toBe(3);
    expect(out.corrections).toBe(2);
    expect(out.leaves).toBe(1);
    expect(out.pendingDevices).toBe(4);
    expect(out.recentAudit).toEqual([
      { id: 'aud-1', action: 'LOGIN', result: 'SUCCESS' },
    ]);
    expect(out.generatedAt).toBeTruthy();

    expect(
      (reports.daily as unknown as ReturnType<typeof vi.fn>),
    ).toHaveBeenCalledWith('2026-10-05', 'u-sup', ['SUPERVISOR'], 'json');
    expect(
      (reports.countReview as unknown as ReturnType<typeof vi.fn>),
    ).toHaveBeenCalledWith('u-sup', ['SUPERVISOR']);
  });

  it('propagates scope from caller roles', async () => {
    const reports = makeReports({
      countReview: vi.fn(async () => 0),
      countCorrections: vi.fn(async () => 0),
      countLeaves: vi.fn(async () => 0),
      countPendingDevices: vi.fn(async () => 0),
      listRecentAudit: vi.fn(async () => []),
    });
    const svc = new DashboardSummaryService(reports);
    const out = await svc.summary('2026-10-05', 'u-adm', ['ADMIN']);
    expect(out.review).toBe(0);
    expect(out.pendingDevices).toBe(0);
    expect(out.recentAudit).toEqual([]);
  });
});
