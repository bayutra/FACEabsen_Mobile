



import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { RequestMeta } from './auth.service.js';
import { AUTH_POLICY } from './constants.js';
import { CurrentUser, Public, type AuthContext } from './decorators.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { DisableTotpDto, EnableTotpDto, RecoverTotpDto, VerifyTotpDto } from './totp.dto.js';
import { TotpService } from './totp.service.js';

const loginThrottle = {
  default: { limit: AUTH_POLICY.loginThrottle.limit, ttl: AUTH_POLICY.loginThrottle.ttl },
};

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@UseGuards(JwtAuthGuard)
@Controller('auth/totp')
export class TotpController {
  constructor(private readonly totp: TotpService) {}

  @HttpCode(HttpStatus.OK)
  @Post('setup')
  setup(@CurrentUser() user: AuthContext) {
    return this.totp.setup(user.userId);
  }

  @Throttle(loginThrottle)
  @HttpCode(HttpStatus.OK)
  @Post('enable')
  enable(@CurrentUser() user: AuthContext, @Body() dto: EnableTotpDto) {
    return this.totp.enable(user.userId, dto.code);
  }

  @HttpCode(HttpStatus.OK)
  @Post('disable')
  disable(@CurrentUser() user: AuthContext, @Body() dto: DisableTotpDto, @Req() req: Request) {
    return this.totp.disable(user.userId, dto.password, metaOf(req));
  }

  @Public()
  @Throttle(loginThrottle)
  @HttpCode(HttpStatus.OK)
  @Post('verify')
  verify(@Body() dto: VerifyTotpDto, @Req() req: Request) {
    return this.totp.verify(dto.totpToken, dto.code, metaOf(req));
  }

  @Public()
  @Throttle(loginThrottle)
  @HttpCode(HttpStatus.OK)
  @Post('recover')
  recover(@Body() dto: RecoverTotpDto, @Req() req: Request) {
    return this.totp.recover(dto.totpToken, dto.recoveryCode, metaOf(req));
  }
}
