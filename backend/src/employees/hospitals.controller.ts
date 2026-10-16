import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermissions, Roles } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { EmployeesService } from './employees.service.js';

/**
 * Read-only facility reference list. Master-data forms (department, shift)
 * need a `hospitalId` picker; the hospitals themselves are provisioned
 * out-of-band, so there are no write routes here.
 */
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly employees: EmployeesService) {}

  @Roles('ADMIN')
  @RequirePermissions('employee:read')
  @Get()
  list() {
    return this.employees.listHospitals();
  }
}