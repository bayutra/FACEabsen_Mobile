import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { DevicesService } from './devices.service.js';
import {
  ActivateDeviceDto,
  ListDevicesQuery,
  RegisterDeviceDto,
  RevokeDeviceDto,
} from './dto.js';

const registerThrottle = {
  default: { limit: 10, ttl: 60_000 },
};

@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Throttle(registerThrottle)
  @Post('register')
  register(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.devices.register(dto, user.userId, { ip: req.ip });
  }

  @Throttle(registerThrottle)
  @Get('register-challenge')
  registerChallenge(@CurrentUser() user: AuthContext) {
    return this.devices.issueRegisterChallenge(user.userId);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthContext) {
    return this.devices.listMine(user.userId);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('device:read')
  @Get()
  listAll(@Query() query: ListDevicesQuery, @CurrentUser() user: AuthContext) {
    return this.devices.listAll(query, user.userId, user.roles);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.devices.getOne(id, user.userId, user.roles);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.devices.heartbeat(id, user.userId);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('device:revoke')
  @HttpCode(HttpStatus.OK)
  @Post(':id/revoke')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeDeviceDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.devices.revoke(id, user.userId, user.roles, dto.reason, {
      ip: req.ip,
    });
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @RequirePermissions('device:approve-replacement')
  @HttpCode(HttpStatus.OK)
  @Post(':id/activate')
  activate(
    @Param('id') id: string,
    @Body() dto: ActivateDeviceDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.devices.activate(id, user.userId, user.roles, dto.note, {
      ip: req.ip,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/mark-lost')
  markLost(
    @Param('id') id: string,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.devices.markLost(id, user.userId, user.roles, { ip: req.ip });
  }
}
