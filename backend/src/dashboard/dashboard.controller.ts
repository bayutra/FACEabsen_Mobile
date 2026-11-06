import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { CurrentUser, RequirePermissions, Roles, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { DashboardSummaryService } from './dashboard-summary.service.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class DashboardSummaryQuery {
  @Matches(DATE_RE)
  date!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly summary: DashboardSummaryService) {}

  @Roles('SUPERVISOR')
  @RequirePermissions('attendance:read:team')
  @Get('summary')
  getSummary(
    @Query() query: DashboardSummaryQuery,
    @CurrentUser() user: AuthContext,
  ) {
    return this.summary.summary(query.date, user.userId, user.roles);
  }
}
