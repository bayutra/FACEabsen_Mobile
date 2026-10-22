




import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestMeta } from './auth.service.js';
import { AUTH_POLICY } from './constants.js';
import {
  buildOtpauthUri,
  generateTotpSecret,
  safeEqual,
  TOTP_TOKEN_PURPOSE,
  TOTP_TOKEN_TTL_SEC,
  verifyTotp,
} from './totp.js';

const RECOVERY_CODE_COUNT = 8;
 
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeRecoveryCode(input: string): string {
  return (input ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function mintRecoveryCode(): string {
  let raw = '';
  while (raw.length < 10) {
    raw += RECOVERY_ALPHABET[randomBytes(1)[0] % RECOVERY_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);
  private readonly accessTtlSec: number;
  private readonly refreshTtlDays: number;
  private readonly totpIssuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.accessTtlSec = Number(config.get('JWT_ACCESS_TTL_SEC', AUTH_POLICY.accessTtlSec));
    this.refreshTtlDays = Number(config.get('REFRESH_TTL_DAYS', AUTH_POLICY.refreshTtlDays));
    this.totpIssuer = String(config.get('TOTP_ISSUER', AUTH_POLICY.jwtIssuer) ?? AUTH_POLICY.jwtIssuer);
    if (!config.get('JWT_ACCESS_SECRET')) {
      this.logger.warn('JWT_ACCESS_SECRET missing — using dev fallback. Set it in production.');
    }
  }

   
  async setup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });
    
    await this.prisma.totpRecoveryCode.deleteMany({ where: { userId } });
    return { secret, otpauthUri: buildOtpauthUri(this.totpIssuer, user.email, secret) };
  }

   
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.totpEnabled) throw new ConflictException('TOTP is already enabled');
    if (!user.totpSecret) throw new BadRequestException('TOTP setup has not been started');
    if (!verifyTotp(user.totpSecret, code)) {
      await this.audit.log({
        actorId: userId,
        action: 'TOTP_FAILED',
        result: 'FAILED',
        metadata: { stage: 'enable' },
      });
      throw new UnauthorizedException('Invalid code');
    }
    const recoveryCodes: string[] = [];
    const seen = new Set<string>();
    while (recoveryCodes.length < RECOVERY_CODE_COUNT) {
      const candidate = mintRecoveryCode();
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      recoveryCodes.push(candidate);
    }
    await this.prisma.totpRecoveryCode.deleteMany({ where: { userId } });
    await this.prisma.totpRecoveryCode.createMany({
      data: recoveryCodes.map((c) => ({ userId, codeHash: sha256(normalizeRecoveryCode(c)) })),
    });
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.audit.log({ actorId: userId, action: 'TOTP_ENABLED' });
    return { recoveryCodes };
  }

   
  async disable(userId: string, password: string, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    await this.prisma.totpRecoveryCode.deleteMany({ where: { userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });
    await this.audit.log({ actorId: userId, action: 'TOTP_DISABLED', ipAddress: meta.ip });
    return { disabled: true as const };
  }

   
  signTotpToken(userId: string) {
    return this.jwt.signAsync(
      { sub: userId, purpose: TOTP_TOKEN_PURPOSE },
      {
        algorithm: AUTH_POLICY.jwtAlgorithm,
        issuer: AUTH_POLICY.jwtIssuer,
        expiresIn: TOTP_TOKEN_TTL_SEC,
      },
    );
  }

   
  async verifyTotpToken(token: string): Promise<string> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        algorithms: [AUTH_POLICY.jwtAlgorithm],
        issuer: AUTH_POLICY.jwtIssuer,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload?.sub || payload.purpose !== TOTP_TOKEN_PURPOSE) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return payload.sub;
  }

   
  async verify(totpToken: string, code: string, meta: RequestMeta = {}) {
    const userId = await this.verifyTotpToken(totpToken);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecret) {
      await this.fail(userId, meta, 'verify');
      throw new UnauthorizedException('Invalid code');
    }
    if (!verifyTotp(user.totpSecret, code)) {
      await this.fail(user.id, meta, 'verify');
      throw new UnauthorizedException('Invalid code');
    }
    return this.issueLogin(user, meta, 'totp');
  }

   
  async recover(totpToken: string, recoveryCode: string, meta: RequestMeta = {}) {
    const userId = await this.verifyTotpToken(totpToken);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    const presentedHash = sha256(normalizeRecoveryCode(recoveryCode));
    const rows = user
      ? await this.prisma.totpRecoveryCode.findMany({ where: { userId: user.id, usedAt: null } })
      : [];
    
    let matchId: string | null = null;
    for (const row of rows) {
      if (safeEqual(row.codeHash, presentedHash)) matchId = row.id;
    }
    if (!user || !user.isActive || !user.totpEnabled || !matchId) {
      await this.fail(userId, meta, 'recover');
      throw new UnauthorizedException('Invalid recovery code');
    }
    const consumed = await this.prisma.totpRecoveryCode.updateMany({
      where: { id: matchId, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      await this.fail(user.id, meta, 'recover');
      throw new UnauthorizedException('Invalid recovery code');
    }
    return this.issueLogin(user, meta, 'totp-recovery');
  }

  

  private async fail(userId: string, meta: RequestMeta, stage: string) {
    await this.audit.log({
      actorId: userId,
      action: 'TOTP_FAILED',
      ipAddress: meta.ip,
      result: 'FAILED',
      metadata: { stage },
    });
  }

  private async issueLogin(
    user: { id: string; email: string; userRoles?: Array<{ role: { name: string } }> },
    meta: RequestMeta,
    method: string,
  ) {
    const roles = (user.userRoles ?? []).map((ur) => ur.role.name);
    const session = await this.createSession(user.id, meta);
    const accessToken = await this.signAccess(user.id, user.email, roles, session.id);
    await this.audit.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress: meta.ip,
      deviceId: session.deviceId,
      metadata: { sessionId: session.id, method },
    });
    return {
      accessToken,
      refreshToken: session.refreshToken,
      expiresIn: this.accessTtlSec,
      user: { id: user.id, email: user.email, roles },
    };
  }

  private async createSession(userId: string, meta: RequestMeta) {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId,
        deviceId: null,
        refreshTokenHash: sha256(refreshToken),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: addDays(new Date(), this.refreshTtlDays),
      },
    });
    return { ...session, refreshToken };
  }

  private signAccess(sub: string, email: string, roles: string[], sid: string) {
    return this.jwt.signAsync(
      { sub, email, roles, sid },
      { algorithm: AUTH_POLICY.jwtAlgorithm, issuer: AUTH_POLICY.jwtIssuer, expiresIn: this.accessTtlSec },
    );
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}
