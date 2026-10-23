import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export const ATTENDANCE_CHALLENGE_PURPOSE = 'attendance-challenge';

@Injectable()
export class ChallengeService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private batch(): number {
    const v = Number(this.config.get('ATTENDANCE_NONCE_BATCH', 10));
    return Number.isFinite(v) && v > 0 && v <= 20 ? v : 10;
  }

  private ttlSec(): number {
    const min = Number(this.config.get('ATTENDANCE_CHALLENGE_TTL_MIN', 1440));
    const safe = Number.isFinite(min) && min >= 60 && min <= 1440 ? min : 1440;
    return safe * 60;
  }

  async issue(
    userId: string,
    deviceId?: string,
  ): Promise<{ nonces: string[]; expiresAt: string }> {
    const nonces: string[] = [];
    const ttl = this.ttlSec();
    for (let i = 0; i < this.batch(); i++) {
      const token = await this.jwt.signAsync(
        {
          sub: userId,
          purpose: ATTENDANCE_CHALLENGE_PURPOSE,
          deviceId: deviceId ?? null,
          jti: randomUUID(),
        },
        { expiresIn: ttl, issuer: 'faceabsen' },
      );
      nonces.push(token);
    }
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    return { nonces, expiresAt };
  }

  async consume(input: {
    nonce: string;
    userId: string;
    deviceId: string;
    employeeId: string;
    action: 'check-in' | 'check-out';
  }): Promise<{ jti: string }> {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(input.nonce, {
        algorithms: ['HS256'],
        issuer: 'faceabsen',
      });
    } catch {
      throw new UnprocessableEntityException({
        reason: 'CHALLENGE_INVALID',
        message: 'Sesi presensi tidak valid',
      });
    }
    if (
      payload?.purpose !== ATTENDANCE_CHALLENGE_PURPOSE ||
      payload?.sub !== input.userId ||
      payload?.deviceId !== input.deviceId ||
      typeof payload?.jti !== 'string'
    ) {
      throw new UnprocessableEntityException({
        reason: 'CHALLENGE_INVALID',
        message: 'Sesi presensi tidak valid',
      });
    }
    const jti = payload.jti as string;
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key: `nonce:${jti}`,
          kind: 'nonce',
          employeeId: input.employeeId,
          action: input.action,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new UnprocessableEntityException({
          reason: 'CHALLENGE_INVALID',
          message: 'Sesi presensi tidak valid',
        });
      }
      throw err;
    }
    return { jti };
  }

  async release(jti: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { key: `nonce:${jti}`, kind: 'nonce' },
    });
  }
}