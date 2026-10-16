import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type DayStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE' | 'OFF';

export interface DayEvidence {
  onLeave: boolean;
  scheduled: boolean;
  checkInStatus?: string | null;
}

/** Pure day classifier (unit-tested). Leave wins over schedule. */
export function classifyDay(ev: DayEvidence): DayStatus {
  if (ev.onLeave) return 'ON_LEAVE';
  if (!ev.scheduled) return 'OFF';
  if (!ev.checkInStatus) return 'ABSENT';
  return ev.checkInStatus === 'ON_TIME' ? 'PRESENT' : 'LATE';
}

export const MAX_RANGE_DAYS = 400;

/** Range guard for endpoints that query by date span without enumerating days. */
export function assertRangeDays(from: string, to: string): void {
  const span =
    Math.floor(
      (new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1;
  if (span > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Date range exceeds ${MAX_RANGE_DAYS} days`);
  }
}

export function eachDay(from: string, to: string): string[] {
  const cur = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const span = Math.floor((end.getTime() - cur.getTime()) / 86_400_000) + 1;
  if (span > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Date range exceeds ${MAX_RANGE_DAYS} days`);
  }
  const days: string[] = [];
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/**
 * STEP 17 — Supervisor team scope (PRD §62).
 * Every method is confined to the supervisor's subordinates unless the
 * caller is ADMIN+; team membership is resolved server-side, never trusted
 * from request parameters.
 */
@Injectable()
export class SupervisorService {
  constructor(private readonly prisma: PrismaService) {}

  async teamOf(userId: string, roles: string[]) {
    // ADMIN is facility-scoped (SUPER_ADMIN alone sees every facility).
    if (satisfiesRole(roles, 'ADMIN') && !satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      return this.prisma.employee.findMany({
        where: { status: 'ACTIVE', department: { hospitalId: scope.hospitalId } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, employeeNo: true, position: true, department: { select: { id: true, name: true } } },
      });
    }
    if (satisfiesRole(roles, 'ADMIN')) {
      return this.prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, employeeNo: true, position: true, department: { select: { id: true, name: true } } },
      });
    }
    const me = await this.prisma.employee.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException('No employee profile for this account');
    return this.prisma.employee.findMany({
      where: { supervisorId: me.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, employeeNo: true, position: true, department: { select: { id: true, name: true } } },
    });
  }

  async teamAttendance(userId: string, roles: string[], query: { from?: string; to?: string; status?: string }) {
    if (query.from && query.to) assertRangeDays(query.from, query.to);
    const ids = (await this.teamOf(userId, roles)).map((m) => m.id);
    const AND: Array<Record<string, unknown>> = [{ employeeId: { in: ids } }];
    if (query.from) AND.push({ workDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ workDate: { lte: new Date(query.to) } });
    if (query.status) AND.push({ checkInStatus: query.status });
    return this.prisma.attendance.findMany({
      where: { AND },
      orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
      take: 500,
      include: {
        shift: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true, employeeNo: true } },
      },
    });
  }

  async memberDetail(id: string, userId: string, roles: string[]) {
    const member = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!member) throw new NotFoundException('Employee not found');
    await this.assertInScope(member.id, userId, roles);
    const recent = await this.prisma.attendance.findMany({
      where: { employeeId: id },
      orderBy: [{ workDate: 'desc' }],
      take: 10,
      include: { shift: { select: { id: true, name: true } } },
    });
    return { member, recent };
  }

  async summary(userId: string, roles: string[], from: string, to: string) {
    const members = await this.teamOf(userId, roles);
    const ids = members.map((m) => m.id);
    const days = eachDay(from, to);
    const [schedules, rows, leaves] = await Promise.all([
      this.prisma.employeeSchedule.findMany({
        where: { employeeId: { in: ids }, workDate: { gte: new Date(from), lte: new Date(to) } },
      }),
      this.prisma.attendance.findMany({
        where: { employeeId: { in: ids }, workDate: { gte: new Date(from), lte: new Date(to) } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: 'APPROVED',
          startDate: { lte: new Date(to) },
          endDate: { gte: new Date(from) },
        },
      }),
    ]);

    const byMember = new Map(members.map((m) => [m.id, { ...m, days: {} as Record<string, DayStatus> }]));
    for (const m of members) {
      const rec = byMember.get(m.id);
      if (!rec) continue;
      for (const d of days) {
        const onLeave = leaves.some((l) => l.employeeId === m.id && d >= iso(l.startDate) && d <= iso(l.endDate));
        const scheduled = schedules.some((s) => s.employeeId === m.id && iso(s.workDate) === d);
        const att = rows.find((a) => a.employeeId === m.id && iso(a.workDate) === d);
        rec.days[d] = classifyDay({ onLeave, scheduled, checkInStatus: att?.checkInStatus });
      }
    }

    const totals = { members: members.length, present: 0, late: 0, absent: 0, onLeave: 0 };
    for (const rec of byMember.values()) {
      for (const d of days) {
        const s = rec.days[d];
        if (s === 'PRESENT') totals.present++;
        else if (s === 'LATE') totals.late++;
        else if (s === 'ABSENT') totals.absent++;
        else if (s === 'ON_LEAVE') totals.onLeave++;
      }
    }
    return { from, to, totals, members: [...byMember.values()] };
  }

  private async assertInScope(memberId: string, userId: string, roles: string[]) {
    if (satisfiesRole(roles, 'SUPER_ADMIN')) return;
    if (satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') throw new ForbiddenException('Not in your facility');
      const target = await this.prisma.employee.findUnique({
        where: { id: memberId },
        include: { department: { select: { hospitalId: true } } },
      });
      if (!target?.department || target.department.hospitalId !== scope.hospitalId) {
        throw new ForbiddenException('Not in your facility');
      }
      return;
    }
    const me = await this.prisma.employee.findUnique({ where: { userId } });
    const target = await this.prisma.employee.findUnique({ where: { id: memberId } });
    if (!me || !target || target.supervisorId !== me.id) {
      throw new ForbiddenException('Not in your team');
    }
  }
}

function iso(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}
