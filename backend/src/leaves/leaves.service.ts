import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLeaveDto, ListLeavesQuery } from './dto.js';

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateLeaveDto,
    userId: string,
    meta: { ip?: string } = {},
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee)
      throw new NotFoundException('No employee profile for this account');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new UnprocessableEntityException({
        reason: 'INVERTED_RANGE',
        message: 'Tanggal selesai sebelum tanggal mulai',
      });
    }

    const clash = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (clash)
      throw new ConflictException(
        'Overlapping leave already exists for these dates',
      );

    const row = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type: dto.type as never,
        startDate: start,
        endDate: end,
        reason: dto.reason,
        evidenceUrl: dto.evidenceUrl,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'LEAVE_CREATED',
      targetType: 'leave_request',
      targetId: row.id,
      ipAddress: meta.ip,
      metadata: {
        type: dto.type,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });
    return row;
  }

  async listMine(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) return [];
    return this.prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: [{ startDate: 'desc' }],
    });
  }

  async listQueue(userId: string, roles: string[], query: ListLeavesQuery) {
    const reviewer = await this.prisma.employee.findUnique({
      where: { userId },
    });
    const isAdmin = satisfiesRole(roles, 'ADMIN');
    const AND: Array<Record<string, unknown>> = [];
    if (!isAdmin) {
      if (!reviewer) return [];
      AND.push({ employee: { supervisorId: reviewer.id } });
    } else if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      AND.push({ employee: { department: { hospitalId: scope.hospitalId } } });
    }
    if (query.status) AND.push({ status: query.status });
    if (query.employeeId) AND.push({ employeeId: query.employeeId });
    if (query.from) AND.push({ endDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ startDate: { lte: new Date(query.to) } });
    return this.prisma.leaveRequest.findMany({
      where: AND.length > 0 ? { AND } : {},
      orderBy: [{ startDate: 'desc' }],

      take: 200,
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
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
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'PENDING')
      throw new ConflictException('Request already reviewed');
    await this.assertCanReview(req.employeeId, reviewerId, roles);

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
    await this.audit.log({
      actorId: reviewerId,
      action: 'LEAVE_APPROVED',
      targetType: 'leave_request',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { note: note ?? null },
    });
    return updated;
  }

  async reject(
    id: string,
    reviewerId: string,
    roles: string[],
    note?: string,
    meta: { ip?: string } = {},
  ) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'PENDING')
      throw new ConflictException('Request already reviewed');
    await this.assertCanReview(req.employeeId, reviewerId, roles);

    const updated = await this.prisma.leaveRequest.update({
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
      action: 'LEAVE_REJECTED',
      targetType: 'leave_request',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { note: note ?? null },
    });
    return updated;
  }

  async cancel(id: string, userId: string) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!req || !employee || req.employeeId !== employee.id) {
      throw new NotFoundException('Leave request not found');
    }
    if (req.status !== 'PENDING')
      throw new ConflictException('Only pending requests can be cancelled');
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log({
      actorId: userId,
      action: 'LEAVE_CANCELLED',
      targetType: 'leave_request',
      targetId: id,
    });
    return updated;
  }

  private async assertCanReview(
    employeeId: string,
    reviewerId: string,
    roles: string[],
  ) {
    const reviewer = await this.prisma.employee.findUnique({
      where: { userId: reviewerId },
      select: { id: true },
    });
    if (reviewer?.id === employeeId) {
      throw new ForbiddenException({
        reason: 'SELF_APPROVAL_FORBIDDEN',
        message: 'Tidak dapat menyetujui pengajuan sendiri',
      });
    }
    if (satisfiesRole(roles, 'SUPER_ADMIN')) return;
    if (satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, reviewerId, roles);
      if (scope.kind !== 'hospital')
        throw new ForbiddenException('Not authorized to review this request');
      const target = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: { department: { select: { hospitalId: true } } },
      });
      if (
        !target?.department ||
        target.department.hospitalId !== scope.hospitalId
      ) {
        throw new ForbiddenException('Not authorized to review this request');
      }
      return;
    }
    const reviewerEmployee = await this.prisma.employee.findUnique({
      where: { userId: reviewerId },
    });
    const target = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!reviewerEmployee || !target || target.supervisorId !== reviewerEmployee.id) {
      throw new ForbiddenException('Not authorized to review this request');
    }
  }
}
