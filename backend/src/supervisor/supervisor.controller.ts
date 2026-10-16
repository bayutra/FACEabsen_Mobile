import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SupervisorService } from './supervisor.service.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class TeamAttendanceQuery {
  @IsOptional()
  @Matches(DATE_RE)
  from?: string;

  @IsOptional()
  @Matches(DATE_RE)
  to?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class SummaryQuery {
  @Matches(DATE_RE)
  from!: string;

  @Matches(DATE_RE)
  to!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPERVISOR')
@Controller('supervisor')
export class SupervisorController {
  constructor(private readonly supervisor: SupervisorService) {}

  @RequirePermissions('attendance:read:team')
  @Get('team')
  team(@CurrentUser() user: AuthContext) {
    return this.supervisor.teamOf(user.userId, user.roles);
  }

  @RequirePermissions('attendance:read:team')
  @Get('team/:id')
  member(
    @Param('id') id: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.supervisor.memberDetail(id, user.userId, user.roles);
  }

  @RequirePermissions('attendance:read:team')
  @Get('attendance')
  attendance(
    @CurrentUser() user: AuthContext,
    @Query() query: TeamAttendanceQuery,
  ) {
    return this.supervisor.teamAttendance(user.userId, user.roles, query);
  }

  @RequirePermissions('report:read:team')
  @Get('summary')
  summary(
    @CurrentUser() user: AuthContext,
    @Query() query: SummaryQuery,
  ) {
    return this.supervisor.summary(user.userId, user.roles, query.from, query.to);
  }
}
