import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { Redis as IORedis } from 'ioredis';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CorrectionsModule } from './corrections/corrections.module.js';
import { LeavesModule } from './leaves/leaves.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SupervisorModule } from './supervisor/supervisor.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { FaceModule } from './face/face.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisThrottlerStorage } from './rate-limit/redis-storage.js';
import { UserThrottlerGuard } from './rate-limit/user-throttler.guard.js';
import { ShiftsModule } from './shifts/shifts.module.js';
import { validateEnv } from './config-validation.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate: (env: Record<string, unknown>) => {
        validateEnv(env);
        return env;
      },
    }),
    
    
    
    
    
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL', '');
        if (!redisUrl) {
          return [{ name: 'default', ttl: 60_000, limit: 600 }];
        }
        const client = new IORedis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
        client.on('error', (e: Error) => console.warn(`[redis] ${e.message}`));
        return {
          throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }],
          storage: new RedisThrottlerStorage(client),
        };
      },
    }),
    PrismaModule,
    AuditModule,
    AttendanceModule,
    CorrectionsModule,
    LeavesModule,
    PrivacyModule,
    ReportsModule,
    SupervisorModule,
    AuthModule,
    DevicesModule,
    EmployeesModule,
    FaceModule,
    ShiftsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}
