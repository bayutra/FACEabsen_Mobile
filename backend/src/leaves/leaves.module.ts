import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LeavesController } from './leaves.controller.js';
import { LeavesService } from './leaves.service.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
