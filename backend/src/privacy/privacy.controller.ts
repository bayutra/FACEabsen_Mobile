import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ConsentDto, NoticeDto } from './dto.js';
import { PrivacyService } from './privacy.service.js';

@UseGuards(JwtAuthGuard)
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('notice')
  notice(@Query() _query: NoticeDto) {
    return this.privacy.notice();
  }

  @HttpCode(HttpStatus.OK)
  @Post('consent')
  consent(@Body() dto: ConsentDto, @CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.privacy.grantOrRevoke(user.userId, dto.purpose, dto.granted, { ip: req.ip }, dto.version);
  }

  @Get('consents/me')
  myConsents(@CurrentUser() user: AuthContext) {
    return this.privacy.myConsents(user.userId);
  }

  @Get('export/me')
  exportMine(@CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.privacy.exportMine(user.userId, { ip: req.ip });
  }

  @Delete('face/me')
  eraseFace(@CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.privacy.eraseFace(user.userId, { ip: req.ip });
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions('system:manage')
  @HttpCode(HttpStatus.OK)
  @Post('retention/run')
  runRetention(@CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.privacy.runRetention(user.userId, { ip: req.ip });
  }
}
