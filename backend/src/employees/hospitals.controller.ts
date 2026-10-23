import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  RequirePermissions,
  Roles,
  type AuthContext,
} from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EmployeesService } from './employees.service.js';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly employees: EmployeesService) {}

  @Roles('ADMIN')
  @RequirePermissions('employee:read')
  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.employees.listHospitals(user.userId, user.roles);
  }
}
