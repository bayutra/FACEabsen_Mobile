import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RegisterPushTokenDto } from './push.dto.js';
import { PushService } from './push.service.js';

const registerThrottle = {
  default: { limit: 20, ttl: 60_000 },
};

/**
 * FCM registration tokens for the signed-in user's own devices. Tokens are
 * only ever bound to an ACTIVE device that belongs to the caller; delivery
 * happens server-side from the notification hooks (corrections, leave,
 * device replacement).
 */
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Throttle(registerThrottle)
  @Post('tokens')
  register(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() user: AuthContext,
  ) {
    return this.push.registerToken(dto, user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('tokens/:token')
  unregister(
    @Param('token') token: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.push.unregisterToken(token, user.userId);
  }
}
