import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service.js';

export interface DashboardSummary {
  date: string;
  report: unknown;
  review: number;
  corrections: number;
  leaves: number;
  pendingDevices: number;
  recentAudit: Array<Record<string, unknown>>;
  generatedAt: string;
}

@Injectable()
export class DashboardSummaryService {
  constructor(private readonly reports: ReportsService) {}

  async summary(
    date: string,
    userId: string,
    roles: string[],
  ): Promise<DashboardSummary> {
    const [daily, review, corrections, leaves, pendingDevices, recentAudit] =
      await Promise.all([
        this.reports.daily(date, userId, roles, 'json'),
        this.reports.countReview(userId, roles),
        this.reports.countCorrections(userId, roles),
        this.reports.countLeaves(userId, roles),
        this.reports.countPendingDevices(userId, roles),
        this.reports.listRecentAudit(userId, roles, 6),
      ]);

    return {
      date,
      report: (daily as { report: unknown }).report,
      review,
      corrections,
      leaves,
      pendingDevices,
      recentAudit,
      generatedAt: new Date().toISOString(),
    };
  }
}
