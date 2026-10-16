import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateLeaveDto, ListLeavesQuery, ReviewLeaveDto } from './dto.js';
import { LeavesService } from './leaves.service.js';

@UseGuards(JwtAuthGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Post()
  create(@Body() dto: CreateLeaveDto, @CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.leaves.create(dto, user.userId, { ip: req.ip });
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthContext) {
    return this.leaves.listMine(user.userId);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPERVISOR')
  @RequirePermissions('leave:approve:team')
  @Get()
  queue(@Query() query: ListLeavesQuery, @CurrentUser() user: AuthContext) {
    return this.leaves.listQueue(user.userId, user.roles, query);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPERVISOR')
  @RequirePermissions('leave:approve:team')
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.leaves.approve(id, user.userId, user.roles, dto.reviewNote, { ip: req.ip });
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPERVISOR')
  @RequirePermissions('leave:approve:team')
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.leaves.reject(id, user.userId, user.roles, dto.reviewNote, { ip: req.ip });
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.leaves.cancel(id, user.userId);
  }
}
