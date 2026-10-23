import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { EmailModule } from '../email/email.module.js';
import { AUTH_POLICY } from './constants.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { TotpController } from './totp.controller.js';
import { TotpService } from './totp.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET', 'dev-only-secret'),
        signOptions: {
          algorithm: AUTH_POLICY.jwtAlgorithm,
          issuer: AUTH_POLICY.jwtIssuer,
          expiresIn: Number(
            config.get('JWT_ACCESS_TTL_SEC', AUTH_POLICY.accessTtlSec),
          ),
        },
        verifyOptions: {
          algorithms: [AUTH_POLICY.jwtAlgorithm],
          issuer: AUTH_POLICY.jwtIssuer,
        },
      }),
    }),
    EmailModule,
  ],
  controllers: [AuthController, TotpController],
  providers: [
    AuthService,
    TotpService,
    EmailVerificationService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],

  exports: [
    AuthService,
    TotpService,
    EmailVerificationService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class AuthModule {}
