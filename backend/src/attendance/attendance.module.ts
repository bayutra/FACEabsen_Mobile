import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { FaceModule } from '../face/face.module.js';
import { IntegrityModule } from '../integrity/integrity.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrivacyModule } from '../privacy/privacy.module.js';
import { RiskModule } from '../risk/risk.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { ChallengeService } from './challenge.service.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    DevicesModule,
    FaceModule,
    IntegrityModule,
    PrivacyModule,
    RiskModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, ChallengeService],
  exports: [AttendanceService, ChallengeService],
})
export class AttendanceModule {}
