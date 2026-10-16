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
import { RequirePermissions, Roles, CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto.js';
import { EmployeesService } from './employees.service.js';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly employees: EmployeesService) {}

  @Roles('ADMIN')
  @RequirePermissions('employee:read')
  @Get()
  list(@Query('hospitalId') hospitalId: string | undefined, @CurrentUser() user: AuthContext) {
    return this.employees.listDepartments(hospitalId, user.userId, user.roles);
  }

  @Roles('ADMIN')
  @RequirePermissions('department:manage')
  @Post()
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: AuthContext, @Req() req: Request) {
    return this.employees.createDepartment(dto, actor.userId, { ip: req.ip });
  }

  @Roles('ADMIN')
  @RequirePermissions('department:manage')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() actor: AuthContext,
    @Req() req: Request,
  ) {
    return this.employees.updateDepartment(id, dto, actor.userId, { ip: req.ip });
  }

  @Roles('ADMIN')
  @RequirePermissions('department:manage')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthContext, @Req() req: Request) {
    return this.employees.deleteDepartment(id, actor.userId, { ip: req.ip });
  }
}