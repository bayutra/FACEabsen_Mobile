import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MAX_RANGE_DAYS, classifyDay, eachDay, SupervisorService } from './supervisor.service.js';

describe('classifyDay', () => {
  it('leave wins; unscheduled is off; missing row is absent', () => {
    expect(classifyDay({ onLeave: true, scheduled: true, checkInStatus: 'ON_TIME' })).toBe('ON_LEAVE');
    expect(classifyDay({ onLeave: false, scheduled: false })).toBe('OFF');
    expect(classifyDay({ onLeave: false, scheduled: true })).toBe('ABSENT');
    expect(classifyDay({ onLeave: false, scheduled: true, checkInStatus: 'ON_TIME' })).toBe('PRESENT');
    expect(classifyDay({ onLeave: false, scheduled: true, checkInStatus: 'LATE' })).toBe('LATE');
    expect(classifyDay({ onLeave: false, scheduled: true, checkInStatus: 'VERY_LATE' })).toBe('LATE');
  });

  it('eachDay spans inclusively', () => {
    expect(eachDay('2026-10-01', '2026-10-03')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(eachDay('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
  });

  it('eachDay caps the range to prevent unbounded expansion', () => {
    expect(MAX_RANGE_DAYS).toBe(400);
    expect(() => eachDay('2020-01-01', '2025-01-01')).toThrow();
  });
});

function makePrisma() {
  const employees = new Map<string, any>([
    ['e-sup', { id: 'e-sup', userId: 'u-sup', name: 'Atasan', supervisorId: null, department: { id: 'd1', hospitalId: 'h1' } }],
    ['e-a', { id: 'e-a', userId: 'u-a', name: 'A', supervisorId: 'e-sup', department: { id: 'd1', hospitalId: 'h1' } }],
    ['e-b', { id: 'e-b', userId: 'u-b', name: 'B', supervisorId: 'e-other', department: { id: 'd2', hospitalId: 'h2' } }],
    ['e-adm', { id: 'e-adm', userId: 'u-adm', name: 'Admin', supervisorId: null, department: { id: 'd1', hospitalId: 'h1' } }],
  ]);
  return {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, string> }) =>
        a.where.id ? (employees.get(a.where.id) ?? null) : [...employees.values()].find((e) => e.userId === a.where.userId) ?? null,
      ),
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) => {
        let rows = [...employees.values()];
        if (a.where && typeof a.where === 'object') {
          const w = a.where as Record<string, unknown>;
          if (w.supervisorId) rows = rows.filter((e) => e.supervisorId === w.supervisorId);
          if (w.status) rows = rows.filter(() => true);
          const dept = w.department as { hospitalId?: string } | undefined;
          if (dept?.hospitalId) rows = rows.filter((e) => e.department?.hospitalId === dept.hospitalId);
        }
        return rows.filter((e) => e.id !== 'e-sup').map(({ userId: _u, supervisorId: _s, ...rest }) => rest);
      }),
    },
    employeeSchedule: {
      findMany: vi.fn(async () => [
        { employeeId: 'e-a', workDate: new Date('2026-10-01T00:00:00.000Z') },
        { employeeId: 'e-a', workDate: new Date('2026-10-02T00:00:00.000Z') },
      ]),
    },
    attendance: {
      findMany: vi.fn(async () => [
        { employeeId: 'e-a', workDate: new Date('2026-10-01T00:00:00.000Z'), checkInStatus: 'LATE' },
      ]),
    },
    leaveRequest: {
      findMany: vi.fn(async () => [
        { employeeId: 'e-a', startDate: new Date('2026-10-02T00:00:00.000Z'), endDate: new Date('2026-10-02T00:00:00.000Z') },
      ]),
    },
  } as unknown as PrismaService;
}

describe('SupervisorService.summary', () => {
  it('classifies present/late/absent/leave/off and totals', async () => {
    const svc = new SupervisorService(makePrisma());
    const out = (await svc.summary('u-sup', ['SUPERVISOR'], '2026-10-01', '2026-10-03')) as {
      totals: Record<string, number>;
      members: Array<{ id: string; days: Record<string, string> }>;
    };
    const a = out.members.find((m) => m.id === 'e-a');
    expect(a?.days).toEqual({
      '2026-10-01': 'LATE',
      '2026-10-02': 'ON_LEAVE',
      '2026-10-03': 'OFF',
    });
    expect(out.totals).toMatchObject({ members: 1, late: 1, onLeave: 1, absent: 0, present: 0 });
  });

  it('admin sees all; member detail enforces team scope', async () => {
    const svc = new SupervisorService(makePrisma());
    const team = (await svc.teamOf('u-sup', ['SUPERVISOR'])) as Array<{ id: string }>;
    expect(team.map((m) => m.id)).toEqual(['e-a']);
    const all = (await svc.teamOf('u-adm', ['SUPER_ADMIN'])) as Array<{ id: string }>;
    expect(all.map((m) => m.id).sort()).toEqual(['e-a', 'e-adm', 'e-b']);
    await expect(svc.memberDetail('e-b', 'u-sup', ['SUPERVISOR'])).rejects.toThrow('Not in your team');
  });

  it('ADMIN teamOf is confined to the caller facility (Tahap 2)', async () => {
    const svc = new SupervisorService(makePrisma());
    const team = (await svc.teamOf('u-adm', ['ADMIN'])) as Array<{ id: string }>;
    expect(team.map((m) => m.id).sort()).toEqual(['e-a', 'e-adm']);
    
    await expect(svc.memberDetail('e-b', 'u-adm', ['ADMIN'])).rejects.toThrow('Not in your facility');
    await expect(svc.memberDetail('e-a', 'u-adm', ['ADMIN'])).resolves.toBeDefined();
  });

  it('teamAttendance bounds the result set', async () => {
    const prisma = makePrisma();
    const svc = new SupervisorService(prisma);
    await svc.teamAttendance('u-sup', ['SUPERVISOR'], { from: '2026-10-01', to: '2026-10-03' });
    const findMany = prisma.attendance.findMany as unknown as ReturnType<typeof vi.fn>;
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
  });

  it('summary rejects ranges beyond the cap', async () => {
    const svc = new SupervisorService(makePrisma());
    await expect(svc.summary('u-sup', ['SUPERVISOR'], '2020-01-01', '2025-01-01')).rejects.toThrow();
  });
});
