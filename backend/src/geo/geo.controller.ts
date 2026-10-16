import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, RequirePermissions, Roles, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { GeoCheckDto, UpdateFenceDto } from './dto.js';
import { GeoService } from './geo.service.js';

@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @HttpCode(HttpStatus.OK)
  @Post('check')
  check(@Body() dto: GeoCheckDto, @CurrentUser() user: AuthContext) {
    return this.geo.check(dto, user.userId, user.roles);
  }

  /**
   * The configured fence per facility.
   *
   * `POST /geo/check` only reveals the radius for the hospital that the caller
   * happens to be near, so the admin console had no way to show where each
   * facility's punch point actually is. Read-only, SUPER_ADMIN only — the
   * fence is seeded per hospital and has no write endpoint.
   */
  @Get('fence')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('security:manage')
  fences() {
    return this.geo.fences();
  }

  /**
   * Perimeter edit (SUPER_ADMIN + security:manage). Lat/lon/radius
   * divalidasi DTO; perubahan dicatat GEOFENCE_UPDATED beserta before/after.
   */
  @Put('fence/:hospitalId')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('security:manage')
  updateFence(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: UpdateFenceDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.geo.updateFence(hospitalId, dto, user.userId, req.ip);
  }
}
