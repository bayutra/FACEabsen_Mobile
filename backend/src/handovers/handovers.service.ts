import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { satisfiesRole } from '../auth/rbac.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AcknowledgeHandoverDto, CreateHandoverDto, ListHandoversQuery } from './dto.js';

@Injectable()
export class HandoversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateHandoverDto, userId: string, meta: { ip?: string }) {
    const me = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!me || !me.department?.hospitalId) throw new ForbiddenException('Profil karyawan tidak ditemukan');
    if (dto.toEmployeeId) {
      const target = await this.prisma.employee.findUnique({
        where: { id: dto.toEmployeeId },
        include: { department: { select: { hospitalId: true } } },
      });
      if (!target?.department || target.department.hospitalId !== me.department.hospitalId) {
        throw new BadRequestException({ reason: 'HANDOVER_TARGET_INVALID', message: 'Target operan harus satu rumah sakit' });
      }
    }
    const handover = await this.prisma.handover.create({
      data: {
        hospitalId: me.department.hospitalId,
        departmentId: me.departmentId,
        fromEmployeeId: me.id,
        toEmployeeId: dto.toEmployeeId,
        title: dto.title,
        patientSummary: dto.patientSummary,
        pendingTasks: dto.pendingTasks,
        medications: dto.medications,
        incidents: dto.incidents,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'HANDOVER_CREATED',
      targetType: 'handover',
      targetId: handover.id,
      ipAddress: meta.ip,
    });
    return handover;
  }

  async list(userId: string, roles: string[], query: ListHandoversQuery) {
    const isSuper = satisfiesRole(roles, 'SUPER_ADMIN');
    const isSupervisor = satisfiesRole(roles, 'SUPERVISOR');
    const me = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!me) return [];

    if (isSuper) {
      const where: Record<string, unknown> = {};
      if (query.status) where.status = query.status;
      if (query.departmentId) where.departmentId = query.departmentId;
      return this.prisma.handover.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          fromEmployee: { select: { id: true, name: true, employeeNo: true } },
          toEmployee: { select: { id: true, name: true, employeeNo: true } },
          department: { select: { id: true, name: true } },
        },
      });
    }

    if (isSupervisor) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      const where: Record<string, unknown> = {
        hospitalId: scope.hospitalId,
        OR: [
          { fromEmployee: { supervisorId: me.id } },
          { toEmployee: { supervisorId: me.id } },
        ],
      };
      if (query.status) where.status = query.status;
      if (query.departmentId) where.departmentId = query.departmentId;
      return this.prisma.handover.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          fromEmployee: { select: { id: true, name: true, employeeNo: true } },
          toEmployee: { select: { id: true, name: true, employeeNo: true } },
          department: { select: { id: true, name: true } },
        },
      });
    }

    return this.prisma.handover.findMany({
      where: {
        OR: [{ fromEmployeeId: me.id }, { toEmployeeId: me.id }],
        hospitalId: me.department?.hospitalId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromEmployee: { select: { id: true, name: true, employeeNo: true } },
        toEmployee: { select: { id: true, name: true, employeeNo: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string, userId: string, roles: string[]) {
    const handover = await this.prisma.handover.findUnique({
      where: { id },
      include: {
        fromEmployee: { select: { id: true, name: true, employeeNo: true, supervisorId: true } },
        toEmployee: { select: { id: true, name: true, employeeNo: true, supervisorId: true } },
        department: { select: { id: true, name: true, hospitalId: true } },
      },
    });
    if (!handover) throw new NotFoundException('Handover not found');
    const isSuper = satisfiesRole(roles, 'SUPER_ADMIN');
    const isSupervisor = satisfiesRole(roles, 'SUPERVISOR');
    if (isSuper) return handover;
    const me = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!me) throw new NotFoundException('Handover not found');
    if (isSupervisor) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      const teamOk =
        handover.fromEmployee?.supervisorId === me.id ||
        handover.toEmployee?.supervisorId === me.id;
      if (
        scope.kind !== 'hospital' ||
        handover.hospitalId !== scope.hospitalId ||
        !teamOk
      ) {
        throw new NotFoundException('Handover not found');
      }
      return handover;
    }
    if (
      (handover.fromEmployeeId !== me.id && handover.toEmployeeId !== me.id) ||
      handover.hospitalId !== me.department?.hospitalId
    ) {
      throw new NotFoundException('Handover not found');
    }
    return handover;
  }

  async acknowledge(id: string, userId: string, roles: string[], note?: string, meta?: { ip?: string }) {
    if (!satisfiesRole(roles, 'SUPERVISOR')) throw new ForbiddenException('Forbidden');
    const handover = await this.findOne(id, userId, roles);
    if (handover.status === 'ACKNOWLEDGED') return handover;
    const me = await this.prisma.employee.findUnique({ where: { userId }, select: { id: true } });
    const updated = await this.prisma.handover.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
        notes: note ? `${handover.notes ?? ''}\n[Ack] ${note}`.trim() : handover.notes,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'HANDOVER_ACKNOWLEDGED',
      targetType: 'handover',
      targetId: id,
      ipAddress: meta?.ip,
    });
    return updated;
  }
}
