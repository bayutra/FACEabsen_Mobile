import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsOptional, IsString, Matches } from 'class-validator';
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ReportsService, type ReportFormat } from './reports.service.js';

const FORMATS = ['json', 'csv', 'xlsx', 'pdf'] as const;

function fmt(value: unknown): ReportFormat {
  return (FORMATS as readonly string[]).includes(String(value)) ? (value as ReportFormat) : 'json';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Validated from/to range (malformed dates 400 instead of NaN downstream). */
export class ReportRangeQuery {
  @Matches(DATE_RE)
  from!: string;

  @Matches(DATE_RE)
  to!: string;

  @IsOptional()
  @IsString()
  format?: string;
}

/** Validated single-day query. */
export class ReportDateQuery {
  @Matches(DATE_RE)
  date!: string;

  @IsOptional()
  @IsString()
  format?: string;
}

/** Validated month query (YYYY-MM). */
export class ReportMonthQuery {
  @Matches(MONTH_RE)
  month!: string;

  @IsOptional()
  @IsString()
  format?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPERVISOR')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequirePermissions('attendance:read:team')
  @Get('daily')
  async daily(
    @Query() query: ReportDateQuery,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(await this.reports.daily(query.date, user.userId, user.roles, fmt(query.format)), res);
  }

  @RequirePermissions('report:read:team')
  @Get('monthly')
  async monthly(
    @Query() query: ReportMonthQuery,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(await this.reports.monthly(query.month, user.userId, user.roles, fmt(query.format)), res);
  }

  @RequirePermissions('report:read:team')
  @Get('department')
  async department(
    @Query() query: ReportRangeQuery,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(await this.reports.department(query.from, query.to, user.userId, user.roles, fmt(query.format)), res);
  }

  @RequirePermissions('attendance:read:team')
  @Get('employee/:id')
  async employee(
    @Param('id') id: string,
    @Query() query: ReportRangeQuery,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(await this.reports.employee(id, query.from, query.to, user.userId, user.roles, fmt(query.format)), res);
  }

  @RequirePermissions('report:read:team')
  @Get('late')
  async late(
    @Query() query: ReportRangeQuery,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(await this.reports.late(query.from, query.to, user.userId, user.roles, fmt(query.format)), res);
  }

  @RequirePermissions('report:read:team')
  @Get('leaves')
  async leaves(
    @Query() query: ReportRangeQuery,
    @CurrentUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(await this.reports.leaves(query.from, query.to, user.userId, user.roles, fmt(query.format)), res);
  }

  private send(
    out: { format: string; report?: unknown; filename?: string; contentType?: string; body?: string | Buffer },
    res: Response,
  ) {
    if (out.format === 'json' || !out.filename || !out.contentType || out.body === undefined) {
      return (out as { report: unknown }).report;
    }
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.body);
  }
}
