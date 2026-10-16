import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, RequirePermissions, Roles, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AttendanceService } from './attendance.service.js';
import { AdminHistoryQuery, CheckInDto, CheckOutDto, MyHistoryQuery } from './dto.js';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // anti-abuse on signed flows
  @HttpCode(HttpStatus.OK)
  @Post('check-in')
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.attendance.checkIn(dto, user.userId, { ip: req.ip });
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // anti-abuse on signed flows
  @HttpCode(HttpStatus.OK)
  @Post('check-out')
  checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.attendance.checkOut(dto, user.userId, { ip: req.ip });
  }

  @Get('me')
  historyMine(@Query() query: MyHistoryQuery, @CurrentUser() user: AuthContext) {
    return this.attendance.listMine(user.userId, query);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @RequirePermissions('attendance:read')
  @Get()
  historyAll(@Query() query: AdminHistoryQuery, @CurrentUser() user: AuthContext) {
    return this.attendance.listAll(query, user.userId, user.roles);
  }

  @Get(':id')
  historyOne(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.attendance.getOne(id, user.userId, user.roles);
  }
}
