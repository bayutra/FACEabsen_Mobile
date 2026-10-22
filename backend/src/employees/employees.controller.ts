import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import {
  CreateEmployeeDto,
  ListEmployeesQuery,
  UpdateEmployeeDto,
  UpdateMyProfileDto,
} from './dto.js';
import { EmployeesService } from './employees.service.js';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Roles('ADMIN')
  @RequirePermissions('employee:create')
  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() actor: AuthContext, @Req() req: Request) {
    return this.employees.create(dto, actor.userId, { ip: req.ip });
  }

  @Roles('SUPERVISOR')
  @RequirePermissions('employee:read')
  @Get()
  findAll(@Query() query: ListEmployeesQuery, @CurrentUser() user: AuthContext) {
    return this.employees.findAll(query, user.userId, user.roles);
  }

  @Get('me')
  findMe(@CurrentUser() user: AuthContext) {
    return this.employees.findMyEmployee(user.userId);
  }

   
  @Patch('me')
  updateMe(
    @Body() dto: UpdateMyProfileDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.employees.updateMyProfile(actor.userId, dto, { ip: req.ip });
  }

  @Roles('SUPERVISOR')
  @RequirePermissions('employee:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.employees.findOne(id, user.userId, user.roles);
  }

  @Roles('SUPERVISOR')
  @RequirePermissions('employee:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.employees.update(id, dto, actor.userId, { ip: req.ip });
  }

  @Roles('ADMIN')
  @RequirePermissions('employee:update')
  @HttpCode(HttpStatus.OK)
  @Post(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthContext, @Req() req: Request) {
    return this.employees.deactivate(id, actor.userId, { ip: req.ip });
  }
}
