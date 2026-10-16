import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateChangeRequestDto, ListChangeRequestsQuery, ReviewChangeRequestDto } from './change-request.dto.js';
import { DeviceChangeService } from './device-change.service.js';

@UseGuards(JwtAuthGuard)
@Controller('device-change')
export class DeviceChangeController {
  constructor(private readonly changes: DeviceChangeService) {}

  @Post()
  request(@Body() dto: CreateChangeRequestDto, @CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.changes.request(dto, user.userId, { ip: req.ip });
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthContext) {
    return this.changes.listMine(user.userId);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('device:approve-replacement')
  @Get()
  listAll(@Query() query: ListChangeRequestsQuery, @CurrentUser() user: AuthContext) {
    return this.changes.listAll(query, user.userId, user.roles);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('device:approve-replacement')
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewChangeRequestDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.changes.approve(id, user.userId, user.roles, dto.reviewNote, { ip: req.ip });
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('device:approve-replacement')
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewChangeRequestDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.changes.reject(id, user.userId, user.roles, dto.reviewNote, { ip: req.ip });
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.changes.cancel(id, user.userId);
  }
}
