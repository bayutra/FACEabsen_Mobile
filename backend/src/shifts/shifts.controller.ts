import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  RequirePermissions,
  Roles,
  CurrentUser,
  type AuthContext,
} from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import {
  CreateScheduleDto,
  CreateShiftDto,
  ListSchedulesQuery,
  ListShiftsQuery,
  UpdateShiftDto,
} from './dto.js';
import { ShiftsService } from './shifts.service.js';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller()
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Roles('ADMIN')
  @RequirePermissions('shift:manage')
  @Post('shifts')
  createShift(
    @Body() dto: CreateShiftDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.shifts.createShift(dto, actor.userId, { ip: req.ip });
  }

  @Roles('ADMIN')
  @RequirePermissions('shift:manage')
  @Get('shifts')
  listShifts(
    @Query() query: ListShiftsQuery,
    @CurrentUser() user: AuthContext,
  ) {
    return this.shifts.listShifts(query, user.userId, user.roles);
  }

  @Roles('ADMIN')
  @RequirePermissions('shift:manage')
  @Get('shifts/:id')
  getShift(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.shifts.getShift(id, user.userId, user.roles);
  }

  @Roles('ADMIN')
  @RequirePermissions('shift:manage')
  @Patch('shifts/:id')
  updateShift(
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.shifts.updateShift(id, dto, actor.userId, { ip: req.ip });
  }

  @Roles('ADMIN')
  @RequirePermissions('shift:manage')
  @HttpCode(HttpStatus.OK)
  @Delete('shifts/:id')
  removeShift(
    @Param('id') id: string,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.shifts.deleteShift(id, actor.userId, { ip: req.ip });
  }

  @Roles('ADMIN')
  @RequirePermissions('schedule:manage')
  @Post('schedules')
  assign(
    @Body() dto: CreateScheduleDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.shifts.assignSchedule(dto, actor.userId, { ip: req.ip });
  }

  @Roles('ADMIN')
  @RequirePermissions('schedule:manage')
  @Get('schedules')
  listSchedules(
    @Query() query: ListSchedulesQuery,
    @CurrentUser() user: AuthContext,
  ) {
    return this.shifts.listSchedules(query, user.userId, user.roles);
  }

  @Get('schedules/me')
  mySchedules(
    @Query() query: ListSchedulesQuery,
    @CurrentUser() user: AuthContext,
  ) {
    return this.shifts.listMineFor(user.userId, query);
  }

  @Roles('ADMIN')
  @RequirePermissions('schedule:manage')
  @Get('schedules/:id')
  getSchedule(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.shifts.getSchedule(id, user.userId, user.roles);
  }

  @Roles('ADMIN')
  @RequirePermissions('schedule:manage')
  @HttpCode(HttpStatus.OK)
  @Delete('schedules/:id')
  unassign(
    @Param('id') id: string,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.shifts.unassignSchedule(id, actor.userId, { ip: req.ip });
  }
}
