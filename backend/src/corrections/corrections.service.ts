import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  evaluateCheckIn,
  evaluateCheckOut,
  workDateKeyIn,
} from '../shifts/shift-time.js';
import { assertTimeZone } from '../attendance/helpers.js';
import type { CreateCorrectionDto, ListCorrectionsQuery } from './dto.js';

@Injectable()
export class CorrectionsService {
  private readonly hospitalTz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() config?: ConfigService,
  ) {
    const tz = config?.get('HOSPITAL_TZ', 'Asia/Jakarta') || 'Asia/Jakarta';
    assertTimeZone(tz);
    this.hospitalTz = tz;
  }

  async create(
    dto: CreateCorrectionDto,
    userId: string,
    meta: { ip?: string } = {},
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee)
      throw new NotFoundException('No employee profile for this account');

    const attendance = await this.prisma.attendance.findUnique({
      where: { id: dto.attendanceId },
    });
    if (!attendance || attendance.employeeId !== employee.id) {
      throw new NotFoundException('Attendance not found');
    }
    if (!dto.requestedCheckIn && !dto.requestedCheckOut) {
      throw new UnprocessableEntityException({
        reason: 'NOTHING_TO_CORRECT',
        message: 'Isi jam masuk/ pulang yang dikoreksi',
      });
    }

    const dupe = await this.prisma.correctionRequest.findFirst({
      where: { attendanceId: dto.attendanceId, status: 'PENDING' },
    });
    if (dupe)
      throw new ConflictException(
        'A pending correction already exists for this attendance',
      );

    const row = await this.prisma.correctionRequest.create({
      data: {
        employeeId: employee.id,
        attendanceId: dto.attendanceId,
        type: dto.type as never,
        requestedCheckIn: dto.requestedCheckIn
          ? new Date(dto.requestedCheckIn)
          : undefined,
        requestedCheckOut: dto.requestedCheckOut
          ? new Date(dto.requestedCheckOut)
          : undefined,
        reason: dto.reason,
        evidenceUrl: dto.evidenceUrl,
      },
      include: { attendance: { select: { id: true, workDate: true } } },
    });
    await this.audit.log({
      actorId: userId,
      action: 'CORRECTION_CREATED',
      targetType: 'correction_request',
      targetId: row.id,
      ipAddress: meta.ip,
      metadata: { attendanceId: dto.attendanceId, type: dto.type },
    });
    return row;
  }

  async listMine(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) return [];
    return this.prisma.correctionRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { requestedAt: 'desc' },
      include: {
        attendance: {
          select: {
            id: true,
            workDate: true,
            checkInStatus: true,
            checkOutStatus: true,
          },
        },
      },
    });
  }

  async listQueue(
    userId: string,
    roles: string[],
    query: ListCorrectionsQuery,
  ) {
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
    return this.prisma.correctionRequest.findMany({
      where: AND.length > 0 ? { AND } : {},
      orderBy: { requestedAt: 'desc' },

      take: 200,
      include: {
        employee: { select: { id: true, name: true, employeeNo: true } },
        attendance: {
          select: {
            id: true,
            workDate: true,
            checkInAt: true,
            checkOutAt: true,
          },
        },
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
    const req = await this.prisma.correctionRequest.findUnique({
      where: { id },
      include: { attendance: { include: { shift: true } } },
    });
    if (!req) throw new NotFoundException('Correction request not found');
    if (req.status !== 'PENDING')
      throw new ConflictException('Request already reviewed');
    await this.assertCanReview(req.employeeId, reviewerId, roles);

    const workKey = req.attendance.workDate.toISOString().slice(0, 10);

    if (
      req.requestedCheckIn &&
      workDateKeyIn(req.requestedCheckIn, this.hospitalTz) !== workKey
    ) {
      throw new UnprocessableEntityException({
        reason: 'CORRECTION_OFF_DAY',
        message: 'Jam masuk koreksi di luar tanggal presensi ini',
      });
    }
    if (
      req.requestedCheckOut &&
      workDateKeyIn(req.requestedCheckOut, this.hospitalTz) !== workKey
    ) {
      throw new UnprocessableEntityException({
        reason: 'CORRECTION_OFF_DAY',
        message: 'Jam pulang koreksi di luar tanggal presensi ini',
      });
    }
    const patch: Record<string, unknown> = {};
    if (req.requestedCheckIn) {
      patch.checkInAt = req.requestedCheckIn;
      patch.checkInStatus = evaluateCheckIn(
        req.requestedCheckIn,
        workKey,
        req.attendance.shift,
        this.hospitalTz,
      ).status;
    }
    if (req.requestedCheckOut) {
      patch.checkOutAt = req.requestedCheckOut;
      patch.checkOutStatus = evaluateCheckOut(
        req.requestedCheckOut,
        workKey,
        req.attendance.shift,
        this.hospitalTz,
      ).status;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.attendance.update({
        where: { id: req.attendanceId },
        data: patch,
      });
      const correction = await tx.correctionRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      });
      await this.audit.log(
        {
          actorId: reviewerId,
          action: 'CORRECTION_APPROVED',
          targetType: 'correction_request',
          targetId: id,
          ipAddress: meta.ip,
          metadata: {
            attendanceId: req.attendanceId,
            applied: Object.keys(patch),
            note: note ?? null,
          },
        },
        tx,
      );
      return correction;
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
    const req = await this.prisma.correctionRequest.findUnique({
      where: { id },
    });
    if (!req) throw new NotFoundException('Correction request not found');
    if (req.status !== 'PENDING')
      throw new ConflictException('Request already reviewed');
    await this.assertCanReview(req.employeeId, reviewerId, roles);

    const updated = await this.prisma.correctionRequest.update({
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
      action: 'CORRECTION_REJECTED',
      targetType: 'correction_request',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { note: note ?? null },
    });
    return updated;
  }

  async cancel(id: string, userId: string) {
    const req = await this.prisma.correctionRequest.findUnique({
      where: { id },
    });
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!req || !employee || req.employeeId !== employee.id) {
      throw new NotFoundException('Correction request not found');
    }
    if (req.status !== 'PENDING')
      throw new ConflictException('Only pending requests can be cancelled');
    const updated = await this.prisma.correctionRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log({
      actorId: userId,
      action: 'CORRECTION_CANCELLED',
      targetType: 'correction_request',
      targetId: id,
    });
    return updated;
  }

  private async assertCanReview(
    employeeId: string,
    reviewerId: string,
    roles: string[],
  ) {
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
    const reviewer = await this.prisma.employee.findUnique({
      where: { userId: reviewerId },
    });
    const target = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!reviewer || !target || target.supervisorId !== reviewer.id) {
      throw new ForbiddenException('Not authorized to review this request');
    }
  }
}
