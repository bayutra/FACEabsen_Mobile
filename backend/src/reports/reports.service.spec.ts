import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from './reports.service.js';

function makePrisma() {
  const employees = new Map<string, any>([
    [
      'e-sup',
      {
        id: 'e-sup',
        userId: 'u-sup',
        name: 'Atasan',
        supervisorId: null,
        department: { id: 'd1', name: 'IGD', hospitalId: 'h1' },
      },
    ],
    [
      'e-a',
      {
        id: 'e-a',
        userId: 'u-a',
        employeeNo: 'EMP-001',
        name: 'A',
        supervisorId: 'e-sup',
        department: { id: 'd1', name: 'IGD', hospitalId: 'h1' },
      },
    ],
    [
      'e-x',
      {
        id: 'e-x',
        userId: 'u-x',
        employeeNo: 'EMP-009',
        name: 'X',
        supervisorId: 'e-other',
        department: { id: 'd2', name: 'Lab', hospitalId: 'h2' },
      },
    ],
    [
      'e-adm',
      {
        id: 'e-adm',
        userId: 'u-adm',
        employeeNo: 'EMP-003',
        name: 'Admin',
        supervisorId: null,
        department: { id: 'd1', name: 'IGD', hospitalId: 'h1' },
      },
    ],
  ]);
  const schedules = [
    {
      employeeId: 'e-a',
      shiftId: 's1',
      workDate: new Date('2026-10-05T00:00:00.000Z'),
      shift: { id: 's1', name: 'PAGI' },
      employee: employees.get('e-a'),
    },
  ];
  const rows = [
    {
      employeeId: 'e-a',
      workDate: new Date('2026-10-05T00:00:00.000Z'),
      checkInAt: new Date('2026-10-05T07:20:00.000Z'),
      checkOutAt: null,
      checkInStatus: 'LATE',
      riskScore: 80,
      shift: { id: 's1', name: 'PAGI' },
      employee: employees.get('e-a'),
    },
  ];
  return {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, string> }) =>
        a.where.id
          ? (employees.get(a.where.id) ?? null)
          : ([...employees.values()].find((e) => e.userId === a.where.userId) ??
            null),
      ),
      findMany: vi.fn(async (a: { where?: Record<string, unknown> }) => {
        let list = [...employees.values()];
        const w = a.where as Record<string, unknown> | undefined;
        if (w?.supervisorId)
          list = list.filter((e) => e.supervisorId === w.supervisorId);
        if (
          w?.id &&
          typeof w.id === 'object' &&
          w.id !== null &&
          'in' in (w.id as object)
        ) {
          list = list.filter((e) =>
            ((w.id as { in: string[] }).in ?? []).includes(e.id),
          );
        }
        const dept = w?.department as { hospitalId?: string } | undefined;
        if (dept?.hospitalId)
          list = list.filter(
            (e) => e.department?.hospitalId === dept.hospitalId,
          );
        return list;
      }),
    },
    employeeSchedule: { findMany: vi.fn(async () => schedules) },
    attendance: { findMany: vi.fn(async () => rows) },
    leaveRequest: { findMany: vi.fn(async () => []) },
  } as unknown as PrismaService;
}

describe('ReportsService scope + daily', () => {
  it('supervisor sees team only; admin sees all; daily totals correct', async () => {
    const svc = new ReportsService(makePrisma());

    const team = (await svc.daily(
      '2026-10-05',
      'u-sup',
      ['SUPERVISOR'],
      'json',
    )) as unknown as {
      report: { summary: Array<[string, string]>; rows: string[][] };
    };
    expect(team.report.summary).toContainEqual(['Terjadwal', '1']);
    expect(team.report.summary).toContainEqual(['Terlambat', '1']);
    expect(team.report.rows).toHaveLength(1);

    const all = (await svc.daily(
      '2026-10-05',
      'u-adm',
      ['ADMIN'],
      'json',
    )) as unknown as {
      report: { rows: string[][] };
    };

    expect(all.report.rows.length).toBeGreaterThanOrEqual(1);

    const csv = (await svc.daily(
      '2026-10-05',
      'u-sup',
      ['SUPERVISOR'],
      'csv',
    )) as { filename: string; body: string };
    expect(csv.filename).toContain('.csv');
    expect(csv.body).toContain('EMP-001');

    const xlsx = (await svc.daily(
      '2026-10-05',
      'u-sup',
      ['SUPERVISOR'],
      'xlsx',
    )) as { filename: string; body: Buffer };
    expect(xlsx.filename).toContain('.xlsx');
    expect(xlsx.body.length).toBeGreaterThan(1000);
  });

  it('heatmap aggregates check-ins by weekday and hospital hour', async () => {
    const previous = process.env.HOSPITAL_TZ;
    process.env.HOSPITAL_TZ = 'Asia/Jakarta';
    try {
      const svc = new ReportsService(makePrisma());
      const out = (await svc.heatmap('2026-10-01', '2026-10-31', 'u-sup', [
        'SUPERVISOR',
      ])) as unknown as {
        totalCheckIns: number;
        lateCheckIns: number;
        cells: number[][];
        maxCount: number;
        peak: { day: string; hour: number; count: number } | null;
        summary: Array<[string, string]>;
      };
      expect(out.totalCheckIns).toBe(1);
      expect(out.lateCheckIns).toBe(1);
      expect(out.cells[0][14]).toBe(1); // 07:20 UTC = 14:20 WIB
      expect(out.maxCount).toBe(1);
      expect(out.peak).toEqual({ day: 'Senin', hour: 14, count: 1 });
      expect(out.summary).toContainEqual(['Total check-in', '1']);
    } finally {
      if (previous === undefined) delete process.env.HOSPITAL_TZ;
      else process.env.HOSPITAL_TZ = previous;
    }
  });

  it('employee report enforces self/team/admin scope', async () => {
    const svc = new ReportsService(makePrisma());
    await expect(
      svc.employee(
        'e-a',
        '2026-10-01',
        '2026-10-31',
        'u-a',
        ['EMPLOYEE'],
        'json',
      ),
    ).resolves.toBeDefined();
    await expect(
      svc.employee(
        'e-x',
        '2026-10-01',
        '2026-10-31',
        'u-a',
        ['EMPLOYEE'],
        'json',
      ),
    ).rejects.toThrow('Employee not found');
    await expect(
      svc.employee(
        'e-a',
        '2026-10-01',
        '2026-10-31',
        'u-sup',
        ['SUPERVISOR'],
        'json',
      ),
    ).resolves.toBeDefined();
  });

  it('monthly + late + leaves aggregate', async () => {
    const svc = new ReportsService(makePrisma());
    const m = (await svc.monthly(
      '2026-10',
      'u-sup',
      ['SUPERVISOR'],
      'json',
    )) as unknown as {
      report: { summary: Array<[string, string]> };
    };
    expect(m.report.summary).toContainEqual(['Terlambat', '1']);
    const late = (await svc.late(
      '2026-10-01',
      '2026-10-31',
      'u-sup',
      ['SUPERVISOR'],
      'json',
    )) as unknown as {
      report: { rows: string[][] };
    };
    expect(late.report.rows).toHaveLength(1);
    const pdf = (await svc.late(
      '2026-10-01',
      '2026-10-31',
      'u-sup',
      ['SUPERVISOR'],
      'pdf',
    )) as { body: Buffer };
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('ADMIN scope is confined to the caller facility (Tahap 2)', async () => {
    const svc = new ReportsService(makePrisma());

    const ids = await svc.scopeOf('u-adm', ['ADMIN']);
    expect(ids).toEqual(expect.arrayContaining(['e-sup', 'e-a', 'e-adm']));
    expect(ids).not.toContain('e-x');

    await expect(svc.scopeOf('u-adm', ['SUPER_ADMIN'])).resolves.toBeNull();
  });
});
