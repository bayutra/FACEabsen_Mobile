import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService, type RequestMeta } from './auth.service.js';
import { AUTH_POLICY } from './constants.js';
import { CurrentUser, Public, type AuthContext } from './decorators.js';
import { ChangePasswordDto, LoginDto, RefreshDto, RegisterDto } from './dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

const loginThrottle = {
  default: { limit: AUTH_POLICY.loginThrottle.limit, ttl: AUTH_POLICY.loginThrottle.ttl },
};

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(loginThrottle)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, metaOf(req));
  }

  @Public()
  @Throttle(loginThrottle)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, metaOf(req));
  }

   
  @Public()
  @Throttle({ default: { limit: AUTH_POLICY.loginThrottle.limit, ttl: AUTH_POLICY.loginThrottle.ttl } })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, metaOf(req));
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.auth.logout(user.userId, user.sessionId, metaOf(req));
  }

  @Get('me')
  me(@CurrentUser() user: AuthContext) {
    return this.auth.me(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(user.userId, user.sessionId, dto, metaOf(req));
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthContext) {
    return this.auth.listSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.auth.revokeSession(user.userId, id);
  }
}
