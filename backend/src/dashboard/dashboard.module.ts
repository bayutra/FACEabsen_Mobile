import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardSummaryService } from './dashboard-summary.service.js';

@Module({
  imports: [AuthModule, ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardSummaryService],
})
export class DashboardModule {}
