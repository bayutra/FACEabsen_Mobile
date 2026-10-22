import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { verifyDeviceSignature } from '../attendance/helpers.js';
import { AuditService } from '../audit/audit.service.js';
import { AUTH_POLICY } from '../auth/constants.js';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListDevicesQuery, RegisterDeviceDto } from './dto.js';

export type DeviceCheck =
  | { ok: true; device: { id: string; status: string } }
  | { ok: false; reason: 'UNKNOWN_DEVICE' | 'WRONG_OWNER' | 'NOT_ACTIVE' };

 
export const DEVICE_REGISTER_PURPOSE = 'device-register';
 
export const DEVICE_REGISTER_CHALLENGE_TTL_SEC = 300;

 
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
  ) {}

   
  async issueRegisterChallenge(userId: string): Promise<{ nonce: string; expiresAt: string }> {
    const nonce = await this.jwt.signAsync(
      { sub: userId, purpose: DEVICE_REGISTER_PURPOSE, jti: randomUUID() },
      {
        algorithm: AUTH_POLICY.jwtAlgorithm,
        issuer: AUTH_POLICY.jwtIssuer,
        expiresIn: DEVICE_REGISTER_CHALLENGE_TTL_SEC,
      },
    );
    return {
      nonce,
      expiresAt: new Date(Date.now() + DEVICE_REGISTER_CHALLENGE_TTL_SEC * 1000).toISOString(),
    };
  }

   
  async register(dto: RegisterDeviceDto, userId: string, meta: { ip?: string } = {}) {
    await this.verifyRegistrationProof(dto, userId);
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this account');

    const clash = await this.prisma.device.findFirst({
      where: { OR: [{ installationId: dto.installationId }, { devicePublicKey: dto.devicePublicKey }] },
    });
    if (clash) {
      
      
      
      
      
      if (clash.employeeId === employee.id) return clash;
      throw new ConflictException('Device already registered');
    }

    try {
      const device = await this.prisma.device.create({
        data: {
          employeeId: employee.id,
          installationId: dto.installationId,
          platform: dto.platform,
          deviceName: dto.deviceName,
          appVersion: dto.appVersion,
          devicePublicKey: dto.devicePublicKey,
          status: 'ACTIVE',
        },
      });
      await this.audit.log({
        actorId: userId,
        action: 'DEVICE_REGISTERED',
        targetType: 'device',
        targetId: device.id,
        ipAddress: meta.ip,
        metadata: { status: device.status, platform: dto.platform },
      });
      return device;
    } catch (e) {
      if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Device already registered');
      }
      throw e;
    }
  }

   
  private async verifyRegistrationProof(dto: RegisterDeviceDto, userId: string): Promise<void> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(dto.nonce, {
        algorithms: [AUTH_POLICY.jwtAlgorithm],
        issuer: AUTH_POLICY.jwtIssuer,
      });
    } catch {
      throw new UnauthorizedException('INVALID_REGISTRATION_PROOF');
    }
    if (!payload?.sub || payload.purpose !== DEVICE_REGISTER_PURPOSE || payload.sub !== userId) {
      throw new UnauthorizedException('INVALID_REGISTRATION_PROOF');
    }
    const ok = verifyDeviceSignature(dto.devicePublicKey, dto.nonce, dto.nonceSignature);
    if (!ok) throw new UnauthorizedException('INVALID_REGISTRATION_PROOF');
  }

  async listMine(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) return [];
    return this.prisma.device.findMany({
      where: { employeeId: employee.id },
      orderBy: { registeredAt: 'desc' },
    });
  }

  async getOne(id: string, userId: string, roles: string[]) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, userId: true, name: true, employeeNo: true, department: { select: { hospitalId: true } } } },
        sessions: { select: { id: true, createdAt: true, expiresAt: true, revokedAt: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        oldChanges: { select: { id: true, status: true, requestedAt: true, reason: true }, orderBy: { requestedAt: 'desc' } },
        newChanges: { select: { id: true, status: true, requestedAt: true, reason: true }, orderBy: { requestedAt: 'desc' } },
      },
    });
    if (!device) throw new NotFoundException('Device not found');
    const owner = device.employee.userId === userId;
    if (owner || satisfiesRole(roles, 'SUPER_ADMIN')) return device;
    if (satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind === 'hospital' && device.employee?.department?.hospitalId === scope.hospitalId) {
        return device;
      }
    }
    throw new NotFoundException('Device not found');
  }

  async heartbeat(id: string, userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device || !employee || device.employeeId !== employee.id) {
      throw new NotFoundException('Device not found');
    }
    return this.prisma.device.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }

   
  async validateDeviceFor(employeeId: string, deviceId: string): Promise<DeviceCheck> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return { ok: false, reason: 'UNKNOWN_DEVICE' };
    if (device.employeeId !== employeeId) return { ok: false, reason: 'WRONG_OWNER' };
    if (device.status !== 'ACTIVE') return { ok: false, reason: 'NOT_ACTIVE' };
    return { ok: true, device: { id: device.id, status: device.status } };
  }

  

  async listAll(query: ListDevicesQuery, userId: string, roles: string[]) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Array<Record<string, unknown>> = [];
    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') {
        return { data: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } };
      }
      AND.push({ employee: { department: { hospitalId: scope.hospitalId } } });
    }
    if (query.status) AND.push({ status: query.status });
    if (query.employeeId) AND.push({ employeeId: query.employeeId });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      AND.push({ OR: [{ deviceName: contains }, { installationId: contains }] });
    }
    const where = AND.length > 0 ? { AND } : {};
    const [total, rows] = await Promise.all([
      this.prisma.device.count({ where }),
      this.prisma.device.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async revoke(id: string, adminId: string, roles: string[], reason?: string, meta: { ip?: string } = {}) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { employee: { select: { department: { select: { hospitalId: true } } } } },
    });
    if (!device) throw new NotFoundException('Device not found');
    
    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, adminId, roles);
      if (scope.kind !== 'hospital' || device.employee?.department?.hospitalId !== scope.hospitalId) {
        throw new NotFoundException('Device not found');
      }
    }
    if (device.status === 'REVOKED') return device;

    const updated = await this.prisma.device.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: adminId, revokeReason: reason ?? 'admin-revoke' },
    });
    await this.prisma.session.updateMany({
      where: { deviceId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: adminId,
      action: 'DEVICE_REVOKED',
      targetType: 'device',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { reason: reason ?? 'admin-revoke' },
    });
    return updated;
  }

   
  async activate(
    id: string,
    adminId: string,
    roles: string[],
    note?: string,
    meta: { ip?: string } = {},
  ) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { employee: { select: { department: { select: { hospitalId: true } } } } },
    });
    if (!device) throw new NotFoundException('Device not found');
    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, adminId, roles);
      if (scope.kind !== 'hospital' || device.employee?.department?.hospitalId !== scope.hospitalId) {
        throw new NotFoundException('Device not found');
      }
    }
    if (device.status !== 'PENDING') {
      throw new ConflictException('Only PENDING devices can be activated');
    }

    const updated = await this.prisma.device.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.audit.log({
      actorId: adminId,
      action: 'DEVICE_ACTIVATED',
      targetType: 'device',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { note: note ?? null },
    });
    return updated;
  }

   
  async markLost(id: string, userId: string, roles: string[], meta: { ip?: string } = {}) {    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { employee: { select: { userId: true, department: { select: { hospitalId: true } } } } },
    });
    if (!device) throw new NotFoundException('Device not found');
    const owner = device.employee.userId === userId;
    let allowed = owner || satisfiesRole(roles, 'SUPER_ADMIN');
    if (!allowed && satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      allowed =
        scope.kind === 'hospital' && device.employee?.department?.hospitalId === scope.hospitalId;
    }
    if (!allowed) throw new NotFoundException('Device not found');
    if (device.status === 'LOST') return device;

    const updated = await this.prisma.device.update({
      where: { id },
      data: { status: 'LOST' },
    });
    await this.prisma.session.updateMany({
      where: { deviceId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: userId,
      action: 'DEVICE_MARKED_LOST',
      targetType: 'device',
      targetId: id,
      ipAddress: meta.ip,
    });
    return updated;
  }
}
