import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SupervisorController } from './supervisor.controller.js';
import { SupervisorService } from './supervisor.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SupervisorController],
  providers: [SupervisorService],
  exports: [SupervisorService],
})
export class SupervisorModule {}
