import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import {
  CreateUserDto,
  ListUsersQuery,
  ResetPasswordDto,
  UpdateUserDto,
  VerifyEmailOverrideDto,
} from './dto.js';
import { UsersService } from './users.service.js';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles('SUPER_ADMIN')
  @RequirePermissions('user:manage')
  @Get()
  list(@Query() query: ListUsersQuery, @CurrentUser() user: AuthContext) {
    return this.users.listUsers(query, user.userId, user.roles);
  }

  @Roles('SUPER_ADMIN')
  @RequirePermissions('user:manage')
  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.users.createUser(dto, actor.userId, { ip: req.ip });
  }

  @Roles('SUPER_ADMIN')
  @RequirePermissions('user:manage')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.users.updateUser(id, dto, actor.userId, { ip: req.ip });
  }

  @Roles('SUPER_ADMIN')
  @RequirePermissions('user:manage')
  @Post(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.users.resetPassword(id, dto, actor.userId, { ip: req.ip });
  }

  @Roles('SUPER_ADMIN')
  @RequirePermissions('user:manage')
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.users.approve(id, actor.userId, { ip: req.ip });
  }

  @Roles('SUPER_ADMIN')
  @RequirePermissions('user:manage')
  @Post(':id/verify-email-override')
  verifyEmailOverride(
    @Param('id') id: string,
    @Body() dto: VerifyEmailOverrideDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.users.verifyEmailOverride(id, dto.reason, actor.userId, { ip: req.ip });
  }
}
