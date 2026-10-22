import { Module } from '@nestjs/common';
import { HandoversController } from './handovers.controller.js';
import { HandoversService } from './handovers.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [HandoversController],
  providers: [HandoversService],
})
export class HandoversModule {}
