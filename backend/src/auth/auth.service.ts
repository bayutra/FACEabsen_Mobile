import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { AUTH_POLICY } from './constants.js';
import type { ChangePasswordDto, LoginDto, RegisterDto } from './dto.js';
import { validatePasswordPolicy } from './password.js';
import { EmailVerificationService } from './email-verification.service.js';
import { TOTP_TOKEN_PURPOSE, TOTP_TOKEN_TTL_SEC } from './totp.js';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

interface RoleRow {
  role: { name: string };
}

const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Peran yang area kerjanya hanya ada di dashboard web. */
const DASHBOARD_ONLY_ROLES = new Set(['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtlSec: number;
  private readonly refreshTtlDays: number;
  private readonly maxFailedAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly emailVerification: EmailVerificationService,
  ) {
    this.accessTtlSec = Number(
      config.get('JWT_ACCESS_TTL_SEC', AUTH_POLICY.accessTtlSec),
    );
    this.refreshTtlDays = Number(
      config.get('REFRESH_TTL_DAYS', AUTH_POLICY.refreshTtlDays),
    );
    this.maxFailedAttempts = Number(
      config.get('LOGIN_MAX_ATTEMPTS', AUTH_POLICY.maxFailedAttempts),
    );
    this.lockoutMinutes = Number(
      config.get('LOCKOUT_MINUTES', AUTH_POLICY.lockoutMinutes),
    );
    if (!config.get('JWT_ACCESS_SECRET')) {
      this.logger.warn(
        'JWT_ACCESS_SECRET missing â€” using dev fallback. Set it in production.',
      );
    }
  }

  async getRoles(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return rows.map((r: RoleRow) => r.role.name);
  }

  async getPermissions(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    const out = new Set<string>();
    for (const ur of rows as Array<{
      role: { rolePermissions: Array<{ permission: { key: string } }> };
    }>) {
      for (const rp of ur.role.rolePermissions) out.add(rp.permission.key);
    }
    return [...out];
  }

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { userRoles: { include: { role: true } } },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Account temporarily locked. Try again later.',
      );
    }

    const ok = await argon2.verify(
      user?.passwordHash ?? DUMMY_HASH,
      dto.password,
    );
    if (!user || !ok) {
      await this.registerFailedAttempt(user?.id ?? null, dto.email, meta);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.emailVerifiedAt) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress: meta.ip,
        result: 'DENIED',
        metadata: { reason: 'EMAIL_NOT_VERIFIED' },
      });
      throw new ForbiddenException({
        reason: 'EMAIL_NOT_VERIFIED',
        message: 'Verifikasi email terlebih dahulu',
      });
    }
    if (!user.isActive) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress: meta.ip,
        result: 'DENIED',
        metadata: { reason: 'PENDING_APPROVAL' },
      });
      throw new ForbiddenException({
        reason: 'PENDING_APPROVAL',
        message: 'Akun menunggu persetujuan admin',
      });
    }

    const roles = (user.userRoles as RoleRow[]).map((ur) => ur.role.name);
    // Peran pengelola hanya boleh masuk lewat dashboard web. Mobile tetap
    // menolak walau kredensial benar agar mode admin tidak ada di ponsel.
    if (
      dto.client === 'MOBILE' &&
      roles.some((role) => DASHBOARD_ONLY_ROLES.has(role))
    ) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress: meta.ip,
        result: 'DENIED',
        metadata: { reason: 'DASHBOARD_ONLY_ROLE', roles },
      });
      throw new ForbiddenException({
        reason: 'DASHBOARD_ONLY_ROLE',
        message:
          'Akun admin/supervisor hanya dapat masuk melalui dashboard web',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    if (user.totpEnabled) {
      const totpToken = await this.jwt.signAsync(
        { sub: user.id, purpose: TOTP_TOKEN_PURPOSE },
        {
          algorithm: AUTH_POLICY.jwtAlgorithm,
          issuer: AUTH_POLICY.jwtIssuer,
          expiresIn: TOTP_TOKEN_TTL_SEC,
        },
      );
      return {
        totpRequired: true as const,
        totpToken,
        expiresIn: TOTP_TOKEN_TTL_SEC,
      };
    }

    const session = await this.createSession(user.id, dto.deviceId, meta);
    const accessToken = await this.signAccess(
      user.id,
      user.email,
      roles,
      session.id,
    );

    await this.audit.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress: meta.ip,
      deviceId: session.deviceId,
      metadata: { sessionId: session.id },
    });

    return {
      accessToken,
      refreshToken: session.refreshToken,
      expiresIn: this.accessTtlSec,
      user: { id: user.id, email: user.email, roles },
    };
  }

  async register(dto: RegisterDto, meta: RequestMeta = {}) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    validatePasswordPolicy(dto.password);

    const [userClash, employeeClash] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.employee.findUnique({ where: { email } }),
    ]);
    if (userClash) {
      if (!userClash.emailVerifiedAt) {
        await this.emailVerification.issue(userClash.id, email);
      }
      return { status: 'VERIFICATION_SENT' };
    }
    if (employeeClash) {
      // Jangan hijack profil karyawan yang dibuat admin; anti-enumeration.
      return { status: 'VERIFICATION_SENT' };
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department) throw new BadRequestException('Unit tidak ditemukan');
    }
    const role = await this.prisma.role.findUnique({
      where: { name: 'EMPLOYEE' },
    });
    if (!role) throw new BadRequestException('Peran EMPLOYEE belum tersedia');

    const employeeNo = dto.employeeNo?.trim() || (await this.nextEmployeeNo());
    const passwordHash = await argon2.hash(dto.password);

    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email, passwordHash, isActive: false } });
        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
        await tx.employee.create({
          data: {
            userId: user.id,
            employeeNo,
            name,
            email,
            phone: dto.phone?.trim() || null,
            position: dto.position?.trim() || null,
            departmentId: dto.departmentId ?? null,
          },
        });
        return user.id;
      });
    } catch (e) {
      if (
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email atau nomor karyawan sudah dipakai');
      }
      throw e;
    }

    await this.audit.log({
      actorId: userId,
      action: 'ACCOUNT_REGISTERED',
      targetType: 'user',
      targetId: userId,
      ipAddress: meta.ip,
      metadata: { email, employeeNo },
    });

    await this.emailVerification.issue(userId, email);

    return { status: 'VERIFICATION_SENT' };
  }

  async verifyEmail(dto: { email: string; code: string }, meta: RequestMeta = {}) {
    const res = await this.emailVerification.verify(dto.email, dto.code);
    return { status: 'PENDING_APPROVAL' as const, userId: res.userId };
  }

  async resendVerification(dto: { email: string }, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user && !user.emailVerifiedAt) {
      await this.emailVerification.issue(user.id, dto.email);
    }
    return { status: 'VERIFICATION_SENT' as const };
  }

  private async nextEmployeeNo(): Promise<string> {
    const count = await this.prisma.employee.count();
    for (let i = count + 1; i <= count + 50; i++) {
      const candidate = `EMP-${String(i).padStart(3, '0')}`;
      const clash = await this.prisma.employee.findUnique({
        where: { employeeNo: candidate },
      });
      if (!clash) return candidate;
    }
    throw new ConflictException('Tidak dapat membuat nomor karyawan otomatis');
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}) {
    const prev = await this.prisma.session.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
      },
    });
    if (!prev || prev.revokedAt || prev.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!prev.user.isActive)
      throw new UnauthorizedException('Account inactive');
    if (!prev.user.emailVerifiedAt)
      throw new UnauthorizedException('Email not verified');

    const next = newRefreshToken();
    const rotated = await this.prisma.session.updateMany({
      where: {
        id: prev.id,
        refreshTokenHash: sha256(refreshToken),
        revokedAt: null,
      },
      data: {
        refreshTokenHash: sha256(next),
        expiresAt: addDays(new Date(), this.refreshTtlDays),
        ipAddress: meta.ip ?? prev.ipAddress,
        userAgent: meta.userAgent ?? prev.userAgent,
      },
    });
    if (rotated.count === 0) {
      await this.audit.log({
        actorId: prev.user.id,
        action: 'REFRESH_CONFLICT',
        ipAddress: meta.ip,
        result: 'DENIED',
        metadata: { sessionId: prev.id },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    const roles = (prev.user.userRoles as RoleRow[]).map((ur) => ur.role.name);
    const accessToken = await this.signAccess(
      prev.user.id,
      prev.user.email,
      roles,
      prev.id,
    );
    return { accessToken, refreshToken: next, expiresIn: this.accessTtlSec };
  }

  async logout(userId: string, sessionId: string, meta: RequestMeta = {}) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: userId,
      action: 'LOGOUT',
      ipAddress: meta.ip,
      metadata: { sessionId },
    });
    return { loggedOut: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const [roles, permissions] = await Promise.all([
      this.getRoles(userId),
      this.getPermissions(userId),
    ]);
    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      totpEnabled: user.totpEnabled ?? false,
      roles,
      permissions,
    };
  }

  async changePassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta = {},
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const ok = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    validatePasswordPolicy(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(dto.newPassword),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, NOT: { id: sessionId } },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      ipAddress: meta.ip,
    });
    return { changed: true };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      current: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (!session.revokedAt) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }
    return { revoked: true };
  }

  private async registerFailedAttempt(
    userId: string | null,
    email: string,
    meta: RequestMeta,
  ) {
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const attempts = (user.failedLoginAttempts ?? 0) + 1;
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil:
              attempts >= this.maxFailedAttempts
                ? addMinutes(new Date(), this.lockoutMinutes)
                : undefined,
          },
        });
      }
    }
    await this.audit.log({
      actorId: userId,
      action: 'LOGIN_FAILED',
      ipAddress: meta.ip,
      result: 'FAILED',
      metadata: { email },
    });
  }

  private async createSession(
    userId: string,
    deviceId: string | undefined,
    meta: RequestMeta,
  ) {
    let boundDeviceId: string | null = null;
    if (deviceId) {
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
      });
      if (device) boundDeviceId = device.id;
    }
    const refreshToken = newRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        deviceId: boundDeviceId,
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
      {
        algorithm: AUTH_POLICY.jwtAlgorithm,
        issuer: AUTH_POLICY.jwtIssuer,
        expiresIn: this.accessTtlSec,
      },
    );
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

export interface PrismaServiceLike {
  user: {
    findUnique(args: unknown): Promise<any>;
    update(args: unknown): Promise<any>;
  };
  userRole: { findMany(args: unknown): Promise<any[]> };
  session: {
    create(args: unknown): Promise<any>;
    findUnique(args: unknown): Promise<any>;
    findMany(args: unknown): Promise<any[]>;
    update(args: unknown): Promise<any>;
    updateMany(args: unknown): Promise<unknown>;
  };
  device: { findUnique(args: unknown): Promise<any> };
  auditLog: { create(args: unknown): Promise<unknown> };
}
