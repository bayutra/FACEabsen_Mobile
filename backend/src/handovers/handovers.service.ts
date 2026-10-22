import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    const isSupervisor = satisfiesRole(roles, 'SUPERVISOR');
    const me = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!me) return [];
    if (isSupervisor) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      const where: Record<string, unknown> = { hospitalId: scope.hospitalId };
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
        fromEmployee: { select: { id: true, name: true, employeeNo: true } },
        toEmployee: { select: { id: true, name: true, employeeNo: true } },
        department: { select: { id: true, name: true, hospitalId: true } },
      },
    });
    if (!handover) throw new NotFoundException('Handover not found');
    const isSupervisor = satisfiesRole(roles, 'SUPERVISOR');
    if (!isSupervisor) {
      const me = await this.prisma.employee.findUnique({ where: { userId }, select: { id: true } });
      if (!me || (handover.fromEmployeeId !== me.id && handover.toEmployeeId !== me.id)) {
        throw new NotFoundException('Handover not found');
      }
    } else {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital' || handover.department?.hospitalId !== scope.hospitalId) {
        throw new NotFoundException('Handover not found');
      }
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
