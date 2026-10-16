import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DepartmentsController } from './departments.controller.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { HospitalsController } from './hospitals.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController, DepartmentsController, HospitalsController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
