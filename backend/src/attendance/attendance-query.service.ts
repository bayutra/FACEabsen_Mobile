import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { satisfiesRole } from '../auth/rbac.js';
import {
  resolveEmployeeTenantWhere,
  resolveHospitalScope,
} from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminHistoryQuery,
  MyHistoryQuery,
  ReviewAttendanceDto,
  ReviewQueueQuery,
} from './dto.js';
import { emptyPage, loadEmployeeForUser } from './support.js';

@Injectable()
export class AttendanceQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listMine(userId: string, query: MyHistoryQuery) {
    const employee = await loadEmployeeForUser(this.prisma, userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Array<Record<string, unknown>> = [{ employeeId: employee.id }];
    if (query.from) AND.push({ workDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ workDate: { lte: new Date(query.to) } });
    if (query.checkInStatus) AND.push({ checkInStatus: query.checkInStatus });
    const where = { AND };
    const [total, rows] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          workDate: true,
          checkInAt: true,
          checkOutAt: true,
          checkInStatus: true,
          checkOutStatus: true,
          riskScore: true,
          riskCategory: true,
          needsReview: true,
          shift: {
            select: {
              id: true,
              name: true,
              startTime: true,
              endTime: true,
              overnight: true,
            },
          },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async listReview(query: ReviewQueueQuery, userId: string, roles: string[]) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = await resolveEmployeeTenantWhere(
      this.prisma,
      userId,
      roles,
      { needsReview: true },
    );
    if (!where) return emptyPage(page, pageSize);
    const [total, rows] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          shift: {
            select: { id: true, name: true, startTime: true, endTime: true },
          },
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async review(
    id: string,
    dto: ReviewAttendanceDto,
    userId: string,
    roles: string[],
    meta: { ip?: string } = {},
  ) {
    const row = await this.requireReviewScope(id, userId, roles);
    const reviewer = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (reviewer?.id === row.employeeId) {
      throw new ForbiddenException({
        reason: 'SELF_APPROVAL_FORBIDDEN',
        message: 'Tidak dapat mereview presensi sendiri',
      });
    }
    const note = dto.note?.trim();
    const label = dto.decision === 'APPROVE' ? 'VALIDASI' : 'TOLAK';
    const notes = note
      ? `${row.notes ? `${row.notes}\n` : ''}[${label}] ${note}`
      : row.notes;

    const updated = await this.prisma.attendance.update({
      where: { id },
      data: { needsReview: false, notes },
    });
    await this.audit.log({
      actorId: userId,
      action: 'ATTENDANCE_REVIEWED',
      targetType: 'attendance',
      targetId: id,
      ipAddress: meta.ip,
      metadata: {
        decision: dto.decision,
        note: note ?? null,
        riskScore: row.riskScore,
        riskCategory: row.riskCategory,
        checkInStatus: row.checkInStatus,
      },
    });
    return updated;
  }

  private async requireReviewScope(
    id: string,
    userId: string,
    roles: string[],
  ) {
    const row = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            supervisorId: true,
            department: { select: { hospitalId: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Attendance not found');

    if (satisfiesRole(roles, 'SUPER_ADMIN')) return row;
    if (satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (
        scope.kind === 'hospital' &&
        row.employee.department?.hospitalId === scope.hospitalId
      ) {
        return row;
      }
      throw new ForbiddenException('Not authorized');
    }

    const me = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (me && row.employee.supervisorId === me.id) return row;
    throw new ForbiddenException('Not authorized');
  }

  async listAll(query: AdminHistoryQuery, userId: string, roles: string[]) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Array<Record<string, unknown>> = [];

    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return emptyPage(page, pageSize);
      if (query.departmentId) {
        const dept = await this.prisma.department.findUnique({
          where: { id: query.departmentId },
          select: { hospitalId: true },
        });
        if (!dept || dept.hospitalId !== scope.hospitalId)
          return emptyPage(page, pageSize);
      }
      AND.push({ employee: { department: { hospitalId: scope.hospitalId } } });
    }
    if (query.employeeId) AND.push({ employeeId: query.employeeId });
    if (query.departmentId)
      AND.push({ employee: { departmentId: query.departmentId } });
    if (query.from) AND.push({ workDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ workDate: { lte: new Date(query.to) } });
    if (query.checkInStatus) AND.push({ checkInStatus: query.checkInStatus });
    if (query.riskCategory) AND.push({ riskCategory: query.riskCategory });
    if (query.needsReview !== undefined)
      AND.push({ needsReview: query.needsReview });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      AND.push({
        employee: { OR: [{ name: contains }, { employeeNo: contains }] },
      });
    }
    const where = AND.length > 0 ? { AND } : {};
    const [total, rows] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          shift: {
            select: { id: true, name: true, startTime: true, endTime: true },
          },
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getOne(id: string, userId: string, roles: string[]) {
    const row = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        shift: true,
        employee: {
          select: {
            id: true,
            userId: true,
            name: true,
            employeeNo: true,
            department: { select: { id: true, name: true, hospitalId: true } },
          },
        },
        device: { select: { id: true, deviceName: true, platform: true } },
      },
    });
    if (!row) throw new NotFoundException('Attendance not found');
    const owner = row.employee.userId === userId;
    if (owner || satisfiesRole(roles, 'SUPER_ADMIN')) return row;

    if (satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (
        scope.kind === 'hospital' &&
        row.employee?.department?.hospitalId === scope.hospitalId
      ) {
        return row;
      }
    }
    throw new NotFoundException('Attendance not found');
  }
}
