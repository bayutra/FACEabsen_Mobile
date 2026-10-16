import type { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isOvernightRange, parseHHmm } from './shift-time.js';
import type {
  CreateScheduleDto,
  CreateShiftDto,
  ListSchedulesQuery,
  ListShiftsQuery,
  UpdateShiftDto,
} from './dto.js';

/**
 * STEP 6 — Shift & Schedule (PRD §20, §51).
 * - HH:mm validated at the boundary; overnight consistency enforced in service.
 * - One roster row per (employee, workDate); night shifts anchor on start date.
 * - Schedules with attendance can never be unassigned (history protection).
 */
@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- shifts ----------

  async createShift(dto: CreateShiftDto, actorId: string, meta: { ip?: string } = {}) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: dto.hospitalId } });
    if (!hospital) throw new NotFoundException('Hospital not found');
    // Facility gate: an ADMIN of hospital A cannot define shifts for B.
    await this.assertSameFacility(actorId, dto.hospitalId, 'Hospital not found');
    if (dto.startTime === dto.endTime) {
      throw new BadRequestException('Shift start and end cannot be equal');
    }
    const derived = isOvernightRange(dto.startTime, dto.endTime);
    if (dto.overnight !== undefined && dto.overnight !== derived) {
      throw new BadRequestException(
        `overnight=${dto.overnight} contradicts ${dto.startTime} → ${dto.endTime}`,
      );
    }
    const existing = await this.prisma.shift.findUnique({
      where: { hospitalId_name: { hospitalId: dto.hospitalId, name: dto.name } },
    });
    if (existing) throw new ConflictException('Shift name already exists for this hospital');

    try {
      // Data + audit in one transaction: a failed audit must roll the insert
      // back, otherwise the caller sees 500 while the row is already there.
      return await this.prisma.$transaction(async (tx) => {
        const shift = await tx.shift.create({
          data: {
            hospitalId: dto.hospitalId,
            name: dto.name,
            startTime: dto.startTime,
            endTime: dto.endTime,
            overnight: dto.overnight ?? derived,
            gracePeriodMin: dto.gracePeriodMin ?? 15,
            lateThresholdMin: dto.lateThresholdMin ?? 30,
            earlyCheckoutThresholdMin: dto.earlyCheckoutThresholdMin ?? 15,
          },
        });
        await this.audit.log(
          {
            actorId,
            action: 'SHIFT_CREATED',
            targetType: 'shift',
            targetId: shift.id,
            ipAddress: meta.ip,
            metadata: { name: dto.name, window: `${dto.startTime} -> ${dto.endTime}` },
          },
          tx,
        );
        return shift;
      });
    } catch (e) {
      throw this.mapUnique(e, 'Shift');
    }
  }

  async listShifts(query: ListShiftsQuery, userId: string, roles: string[]) {
    // Facility scoping: ADMIN callers always list their own hospital.
    let hospitalId = query.hospitalId;
    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      hospitalId = scope.hospitalId;
    }
    return this.prisma.shift.findMany({
      where: hospitalId ? { hospitalId } : {},
      orderBy: [{ hospitalId: 'asc' }, { startTime: 'asc' }],
      include: { hospital: { select: { id: true, code: true, name: true } } },
    });
  }

  async getShift(id: string, userId: string, roles: string[]) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { hospital: { select: { id: true, code: true, name: true } } },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    await this.assertSameFacility(userId, shift.hospitalId, 'Shift not found', roles);
    return shift;
  }

  async updateShift(id: string, dto: UpdateShiftDto, actorId: string, meta: { ip?: string } = {}) {
    const existing = await this.prisma.shift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Shift not found');
    await this.assertSameFacility(actorId, existing.hospitalId, 'Shift not found');

    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;
    if (startTime === endTime) throw new BadRequestException('Shift start and end cannot be equal');
    // validate format even when values come from the DB row
    parseHHmm(startTime);
    parseHHmm(endTime);
    const derived = isOvernightRange(startTime, endTime);
    const overnight = dto.overnight ?? derived;
    if (dto.overnight !== undefined && dto.overnight !== derived) {
      throw new BadRequestException(
        `overnight=${dto.overnight} contradicts ${startTime} → ${endTime}`,
      );
    }
    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.shift.findUnique({
        where: { hospitalId_name: { hospitalId: existing.hospitalId, name: dto.name } },
      });
      if (clash) throw new ConflictException('Shift name already exists for this hospital');
    }

    try {
      const shift = await this.prisma.shift.update({
        where: { id },
        data: { ...dto, startTime, endTime, overnight },
      });
      await this.audit.log({
        actorId,
        action: 'SHIFT_UPDATED',
        targetType: 'shift',
        targetId: id,
        ipAddress: meta.ip,
        metadata: { updated: Object.keys(dto) },
      });
      return shift;
    } catch (e) {
      throw this.mapUnique(e, 'Shift');
    }
  }

  /**
   * Shifts are referenced by `EmployeeSchedule.shiftId` and `Attendance`, both
   * Restrict. Rather than let a FK violation surface, refuse while a roster row
   * still points at the shift so the admin unassigns first (PRD §51).
   */
  async deleteShift(id: string, actorId: string, meta: { ip?: string } = {}) {
    const existing = await this.prisma.shift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Shift not found');
    await this.assertSameFacility(actorId, existing.hospitalId, 'Shift not found');

    const used = await this.prisma.employeeSchedule.findFirst({ where: { shiftId: id } });
    if (used) {
      throw new ConflictException('Shift is still on a roster and cannot be deleted');
    }

    await this.prisma.shift.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'SHIFT_DELETED',
      targetType: 'shift',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { name: existing.name },
    });
    return { removed: true };
  }

  // ---------- schedules ----------

  /**
   * Employee-facing: own roster for a date range (mobile "Jadwal" tab).
   * Scoped to the caller's own employee row, so an EMPLOYEE never needs
   * `schedule:manage` to see their own shift (PRD §20, §28).
   */
  async listMineFor(userId: string, query: ListSchedulesQuery) {
    const employee = await this.prisma.employee.findUnique({ where: { userId }, select: { id: true } });
    if (!employee) return { data: [], pagination: { page: 1, pageSize: query.pageSize ?? 20, totalItems: 0, totalPages: 0 } };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Prisma.EmployeeScheduleWhereInput[] = [{ employeeId: employee.id }];
    if (query.shiftId) AND.push({ shiftId: query.shiftId });
    if (query.from) AND.push({ workDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ workDate: { lte: new Date(query.to) } });
    const where: Prisma.EmployeeScheduleWhereInput = { AND };

    const [total, rows] = await Promise.all([
      this.prisma.employeeSchedule.count({ where }),
      this.prisma.employeeSchedule.findMany({
        where,
        orderBy: [{ workDate: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          shift: { select: { id: true, name: true, startTime: true, endTime: true, overnight: true } },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async assignSchedule(dto: CreateScheduleDto, actorId: string, meta: { ip?: string } = {}) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    const shift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    // Both sides of the roster row must sit in the actor's facility.
    await this.assertSameFacility(actorId, employee.department?.hospitalId, 'Employee not found');
    await this.assertSameFacility(actorId, shift.hospitalId, 'Shift not found');

    const clash = await this.prisma.employeeSchedule.findUnique({
      where: { employeeId_workDate: { employeeId: dto.employeeId, workDate: new Date(dto.workDate) } },
    });
    if (clash) throw new ConflictException('Employee already scheduled on this date');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const schedule = await tx.employeeSchedule.create({
          data: { employeeId: dto.employeeId, shiftId: dto.shiftId, workDate: new Date(dto.workDate) },
          include: {
            shift: true,
            employee: { select: { id: true, name: true, employeeNo: true } },
          },
        });
        await this.audit.log(
          {
            actorId,
            action: 'SCHEDULE_ASSIGNED',
            targetType: 'schedule',
            targetId: schedule.id,
            ipAddress: meta.ip,
            metadata: { employeeId: dto.employeeId, shiftId: dto.shiftId, workDate: dto.workDate },
          },
          tx,
        );
        return schedule;
      });
    } catch (e) {
      throw this.mapUnique(e, 'Schedule');
    }
  }

  async listSchedules(query: ListSchedulesQuery, userId: string, roles: string[]) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Array<Record<string, unknown>> = [];
    // Facility scoping via the rostered shift (a foreign employeeId filter
    // intersects to empty naturally).
    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') {
        return { data: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } };
      }
      AND.push({ shift: { hospitalId: scope.hospitalId } });
    }
    if (query.employeeId) AND.push({ employeeId: query.employeeId });
    if (query.shiftId) AND.push({ shiftId: query.shiftId });
    if (query.from) AND.push({ workDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ workDate: { lte: new Date(query.to) } });
    const where = AND.length > 0 ? { AND } : {};

    const [total, rows] = await Promise.all([
      this.prisma.employeeSchedule.count({ where }),
      this.prisma.employeeSchedule.findMany({
        where,
        orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          shift: { select: { id: true, name: true, startTime: true, endTime: true, overnight: true } },
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getSchedule(id: string, userId: string, roles: string[]) {
    const schedule = await this.prisma.employeeSchedule.findUnique({
      where: { id },
      include: {
        shift: true,
        employee: {
          select: { id: true, name: true, employeeNo: true, department: { select: { hospitalId: true } } },
        },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.assertSameFacility(userId, schedule.shift?.hospitalId, 'Schedule not found', roles);
    await this.assertSameFacility(
      userId,
      schedule.employee?.department?.hospitalId ?? schedule.shift?.hospitalId,
      'Schedule not found',
      roles,
    );
    return schedule;
  }

  async unassignSchedule(id: string, actorId: string, meta: { ip?: string } = {}) {
    const existing = await this.prisma.employeeSchedule.findUnique({
      where: { id },
      include: {
        shift: { select: { hospitalId: true } },
        employee: { select: { department: { select: { hospitalId: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    await this.assertSameFacility(actorId, existing.shift?.hospitalId, 'Schedule not found');
    await this.assertSameFacility(
      actorId,
      existing.employee?.department?.hospitalId ?? existing.shift?.hospitalId,
      'Schedule not found',
    );
    const used = await this.prisma.attendance.findFirst({ where: { scheduleId: id } });
    if (used) throw new ConflictException('Schedule has attendance and cannot be removed');

    await this.prisma.employeeSchedule.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'SCHEDULE_UNASSIGNED',
      targetType: 'schedule',
      targetId: id,
      ipAddress: meta.ip,
    });
    return { removed: true };
  }

  private mapUnique(e: unknown, label: string): unknown {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
      return new ConflictException(`${label} already exists`);
    }
    return e;
  }

  /**
   * Facility gate for shift/schedule writes and single-row reads.
   * SUPER_ADMIN bypasses; everyone else must act inside their own hospital.
   * Mismatches surface as 404 so foreign ids stay unenumerable.
   */
  private async assertSameFacility(
    actorId: string,
    targetHospitalId: string | null | undefined,
    message: string,
    actorRoles?: string[],
  ) {
    const roles = actorRoles ?? (await this.getRoles(actorId));
    if (satisfiesRole(roles, 'SUPER_ADMIN')) return;
    const scope = await resolveHospitalScope(this.prisma, actorId, roles);
    if (scope.kind !== 'hospital' || !targetHospitalId || targetHospitalId !== scope.hospitalId) {
      throw new NotFoundException(message);
    }
  }

  private async getRoles(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return rows.map((r) => (r as { role: { name: string } }).role.name);
  }
}
