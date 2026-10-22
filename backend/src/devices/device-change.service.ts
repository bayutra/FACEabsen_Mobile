import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service.js';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateChangeRequestDto,
  ListChangeRequestsQuery,
} from './change-request.dto.js';

@Injectable()
export class DeviceChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async request(
    dto: CreateChangeRequestDto,
    userId: string,
    meta: { ip?: string } = {},
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!employee || !employee.user)
      throw new NotFoundException('No employee profile for this account');

    const verified = await argon2.verify(
      employee.user.passwordHash,
      dto.password,
    );
    if (!verified) {
      await this.audit.log({
        actorId: userId,
        action: 'DEVICE_REPLACEMENT_REQUESTED',
        ipAddress: meta.ip,
        result: 'FAILED',
        metadata: { reason: 'identity-verification-failed' },
      });
      throw new UnauthorizedException('Identity verification failed');
    }

    const oldDevice = await this.prisma.device.findFirst({
      where: {
        employeeId: employee.id,
        status: 'ACTIVE',
        id: { not: dto.newDeviceId },
      },
    });
    if (!oldDevice) throw new ConflictException('No active device to replace');

    const next = await this.prisma.device.findUnique({
      where: { id: dto.newDeviceId },
    });
    if (!next || next.employeeId !== employee.id) {
      throw new NotFoundException('New device not found');
    }
    if (next.id === oldDevice.id)
      throw new ConflictException('New device must differ from current');
    if (next.status === 'REVOKED' || next.status === 'LOST') {
      throw new ConflictException('New device is not eligible for replacement');
    }

    const dupe = await this.prisma.deviceChangeRequest.findFirst({
      where: {
        employeeId: employee.id,
        newDeviceId: next.id,
        status: 'PENDING',
      },
    });
    if (dupe)
      throw new ConflictException(
        'A pending request already exists for this device',
      );

    const req = await this.prisma.deviceChangeRequest.create({
      data: {
        employeeId: employee.id,
        oldDeviceId: oldDevice.id,
        newDeviceId: next.id,
        reason: dto.reason + (dto.reasonNote ? `: ${dto.reasonNote}` : ''),
      },
      include: {
        oldDevice: true,
        newDevice: true,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'DEVICE_REPLACEMENT_REQUESTED',
      targetType: 'device_change_request',
      targetId: req.id,
      ipAddress: meta.ip,
      metadata: {
        oldDeviceId: oldDevice.id,
        newDeviceId: next.id,
        reason: dto.reason,
      },
    });
    return req;
  }

  async listMine(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) return [];
    return this.prisma.deviceChangeRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { requestedAt: 'desc' },
      include: { oldDevice: true, newDevice: true },
    });
  }

  async listAll(
    query: ListChangeRequestsQuery,
    userId: string,
    roles: string[],
  ) {
    const AND: Array<Record<string, unknown>> = [];

    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      AND.push({ employee: { department: { hospitalId: scope.hospitalId } } });
    }
    if (query.status) AND.push({ status: query.status });
    return this.prisma.deviceChangeRequest.findMany({
      where: AND.length > 0 ? { AND } : {},
      orderBy: { requestedAt: 'desc' },

      take: 200,
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        oldDevice: { select: { id: true, deviceName: true, platform: true } },
        newDevice: { select: { id: true, deviceName: true, platform: true } },
      },
    });
  }

  async approve(
    id: string,
    reviewerId: string,
    roles: string[],
    note?: string,
    meta: { ip?: string } = {},
  ) {
    const req = await this.prisma.deviceChangeRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { department: { select: { hospitalId: true } } } },
      },
    });
    if (!req) throw new NotFoundException('Change request not found');
    if (req.status !== 'PENDING')
      throw new ConflictException('Request already reviewed');
    await this.assertSameFacility(
      reviewerId,
      roles,
      req.employee?.department?.hospitalId,
    );

    const oldDevice = req.oldDeviceId
      ? await this.prisma.device.findUnique({ where: { id: req.oldDeviceId } })
      : null;
    const next = await this.prisma.device.findUnique({
      where: { id: req.newDeviceId },
    });
    if (!next || next.status === 'REVOKED' || next.status === 'LOST') {
      throw new ConflictException('New device is no longer eligible');
    }
    if (oldDevice && oldDevice.status !== 'ACTIVE') {
      throw new ConflictException('Old device is no longer active');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (oldDevice) {
        await tx.device.update({
          where: { id: oldDevice.id },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revokedBy: reviewerId,
            revokeReason: `replaced-by:${next.id}`,
          },
        });
        await tx.session.updateMany({
          where: { deviceId: oldDevice.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.device.update({
        where: { id: next.id },
        data: { status: 'ACTIVE' },
      });
      return tx.deviceChangeRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      });
    });

    await this.audit.log({
      actorId: reviewerId,
      action: 'DEVICE_REPLACED',
      targetType: 'device_change_request',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { oldDeviceId: req.oldDeviceId, newDeviceId: req.newDeviceId },
    });
    if (oldDevice) {
      await this.audit.log({
        actorId: reviewerId,
        action: 'DEVICE_REVOKED',
        targetType: 'device',
        targetId: oldDevice.id,
        ipAddress: meta.ip,
        metadata: { reason: `replaced-by:${next.id}` },
      });
    }
    return updated;
  }

  async reject(
    id: string,
    reviewerId: string,
    roles: string[],
    note?: string,
    meta: { ip?: string } = {},
  ) {
    const req = await this.prisma.deviceChangeRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { department: { select: { hospitalId: true } } } },
      },
    });
    if (!req) throw new NotFoundException('Change request not found');
    if (req.status !== 'PENDING')
      throw new ConflictException('Request already reviewed');
    await this.assertSameFacility(
      reviewerId,
      roles,
      req.employee?.department?.hospitalId,
    );

    const updated = await this.prisma.deviceChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
    await this.audit.log({
      actorId: reviewerId,
      action: 'DEVICE_REPLACEMENT_REJECTED',
      targetType: 'device_change_request',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { note: note ?? null },
    });
    return updated;
  }

  private async assertSameFacility(
    reviewerId: string,
    roles: string[],
    targetHospitalId: string | null | undefined,
  ) {
    if (satisfiesRole(roles, 'SUPER_ADMIN')) return;
    const scope = await resolveHospitalScope(this.prisma, reviewerId, roles);
    if (
      scope.kind !== 'hospital' ||
      !targetHospitalId ||
      targetHospitalId !== scope.hospitalId
    ) {
      throw new NotFoundException('Change request not found');
    }
  }

  async cancel(id: string, userId: string) {
    const req = await this.prisma.deviceChangeRequest.findUnique({
      where: { id },
    });
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!req || !employee || req.employeeId !== employee.id) {
      throw new NotFoundException('Change request not found');
    }
    if (req.status !== 'PENDING')
      throw new ConflictException('Only pending requests can be cancelled');
    return this.prisma.deviceChangeRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
