import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CorrectionsService } from './corrections.service.js';
import { CreateCorrectionDto, ListCorrectionsQuery, ReviewCorrectionDto } from './dto.js';

@UseGuards(JwtAuthGuard)
@Controller('corrections')
export class CorrectionsController {
  constructor(private readonly corrections: CorrectionsService) {}

  @Post()
  create(@Body() dto: CreateCorrectionDto, @CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.corrections.create(dto, user.userId, { ip: req.ip });
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthContext) {
    return this.corrections.listMine(user.userId);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPERVISOR')
  @RequirePermissions('correction:approve:team')
  @Get()
  queue(@Query() query: ListCorrectionsQuery, @CurrentUser() user: AuthContext) {
    return this.corrections.listQueue(user.userId, user.roles, query);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPERVISOR')
  @RequirePermissions('correction:approve:team')
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.corrections.approve(id, user.userId, user.roles, dto.reviewNote, { ip: req.ip });
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPERVISOR')
  @RequirePermissions('correction:approve:team')
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.corrections.reject(id, user.userId, user.roles, dto.reviewNote, { ip: req.ip });
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.corrections.cancel(id, user.userId);
  }
}
