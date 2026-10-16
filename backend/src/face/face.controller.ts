import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RegisterFaceDto } from './dto.js';
import { FaceService } from './face.service.js';

@UseGuards(JwtAuthGuard)
@Controller('face')
export class FaceController {
  constructor(private readonly face: FaceService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // biometric writes are expensive
  @HttpCode(HttpStatus.OK)
  @Post('register')
  register(@Body() dto: RegisterFaceDto, @CurrentUser() user: AuthContext, @Req() req: Request) {
    return this.face.register(dto, user.userId, { ip: req.ip });
  }

  @Get('status')
  status(@CurrentUser() user: AuthContext) {
    return this.face.status(user.userId);
  }
}
