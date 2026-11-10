import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AttendanceQueryService } from './attendance-query.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;

type Emp = {
  id: string;
  userId: string;
  departmentId: string | null;
  department: { id: string; hospitalId: string; name?: string } | null;
};

function makePrisma(opts: {
  reviewer?: Emp | null;
  row?: any;
  listRows?: any[];
} = {}) {
  const reviewer: Emp | null =
    'reviewer' in opts
      ? (opts.reviewer as Emp | null)
      : { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } };

  const defaultRow = {
    id: 'a1',
    employeeId: 'e-target',
    needsReview: true,
    notes: null,
    riskScore: 10,
    riskCategory: 'LOW',
    checkInStatus: 'ON_TIME',
    employee: {
      id: 'e-target',
      userId: 'u-target',
      departmentId: 'd1',
      department: { id: 'd1', name: 'IGD', hospitalId: 'h1' },
    },
  };
  const row = 'row' in opts ? opts.row : defaultRow;

  const prisma = {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) => {
        if ('userId' in a.where) {
          // could be loadEmployeeForUser or reviewer lookup; return reviewer-like for u-sup, else generic
          if (a.where.userId === reviewer?.userId) return reviewer;
          return null;
        }
        if ('id' in a.where) return null;
        return null;
      }),
    },
    attendance: {
      count: vi.fn(async () => (opts.listRows ?? [row]).length),
      findMany: vi.fn(async () => opts.listRows ?? [row]),
      findUnique: vi.fn(async () => row),
      update: vi.fn(async (_a: any) => ({ id: 'a1', needsReview: false })),
    },
    department: { findUnique: vi.fn(async () => null) },
  } as unknown as PrismaService;
  return prisma;
}

const svcOf = (prisma: PrismaService) =>
  new AttendanceQueryService(prisma, auditStub);

describe('AttendanceQueryService.listReview (SUPERVISOR unit scope)', () => {
  it('filters queue by reviewer departmentId (unit), not supervisorId', async () => {
    const findMany = vi.fn(async () => []);
    const reviewer = { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } };
    const prisma = {
      employee: {
        findUnique: vi.fn(async (a: any) =>
          a.where?.userId === 'u-sup' ? reviewer : null,
        ),
      },
      attendance: {
        count: vi.fn(async () => 0),
        findMany,
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await svcOf(prisma).listReview({}, 'u-sup', ['SUPERVISOR']);
    const where = findMany.mock.calls[0][0].where as any;
    expect(JSON.stringify(where)).toContain('"departmentId":"d1"');
    expect(JSON.stringify(where)).not.toContain('supervisorId');
  });

  it('returns empty page when reviewer has no employee/departmentId', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = {
      employee: { findUnique: vi.fn(async () => null) },
      attendance: { count: vi.fn(async () => 0), findMany },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const out = await svcOf(prisma).listReview({}, 'u-sup', ['SUPERVISOR']);
    expect(out.pagination.totalItems).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('AttendanceQueryService.review/requireReviewScope (SUPERVISOR unit scope)', () => {
  const baseRow = (over: any = {}) => ({
    id: 'a1',
    employeeId: 'e-target',
    needsReview: true,
    notes: null,
    riskScore: 10,
    riskCategory: 'LOW',
    checkInStatus: 'ON_TIME',
    employee: {
      id: 'e-target',
      userId: 'u-target',
      departmentId: 'd1',
      department: { id: 'd1', hospitalId: 'h1' },
      ...over.employee,
    },
    ...over,
  });

  it('allows SUPERVISOR to review target in same unit', async () => {
    const reviewer = { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } };
    const row = baseRow();
    const update = vi.fn(async () => ({ id: 'a1', needsReview: false }));
    const prisma = {
      employee: { findUnique: vi.fn(async (a: any) => (a.where?.userId === 'u-sup' ? reviewer : null)) },
      attendance: { findUnique: vi.fn(async () => row), update },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await expect(
      svcOf(prisma).review('a1', { decision: 'APPROVE' }, 'u-sup', ['SUPERVISOR']),
    ).resolves.toMatchObject({ id: 'a1' });
    expect(update).toHaveBeenCalled();
  });

  it('rejects SUPERVISOR reviewing target in different unit', async () => {
    const reviewer = { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } };
    const row = baseRow({ employee: { id: 'e-target', userId: 'u-target', departmentId: 'd2', department: { id: 'd2', hospitalId: 'h1' } } });
    const prisma = {
      employee: { findUnique: vi.fn(async (a: any) => (a.where?.userId === 'u-sup' ? reviewer : null)) },
      attendance: { findUnique: vi.fn(async () => row), update: vi.fn() },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await expect(
      svcOf(prisma).review('a1', { decision: 'APPROVE' }, 'u-sup', ['SUPERVISOR']),
    ).rejects.toThrow('Not authorized');
  });

  it('rejects self-review even if same unit', async () => {
    const reviewer = { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } };
    const row = baseRow({ employeeId: 'e-sup', employee: { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } } });
    const prisma = {
      employee: { findUnique: vi.fn(async (a: any) => (a.where?.userId === 'u-sup' ? reviewer : null)) },
      attendance: { findUnique: vi.fn(async () => row), update: vi.fn() },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await expect(
      svcOf(prisma).review('a1', { decision: 'APPROVE' }, 'u-sup', ['SUPERVISOR']),
    ).rejects.toThrow('Tidak dapat mereview presensi sendiri');
  });
});

describe('AttendanceQueryService.getOne (SUPERVISOR unit scope)', () => {
  const row = (over: any = {}) => ({
    id: 'a1',
    employee: {
      id: 'e-target',
      userId: 'u-target',
      departmentId: 'd1',
      name: 'Siti',
      employeeNo: 'EMP-001',
      department: { id: 'd1', name: 'IGD', hospitalId: 'h1' },
      ...over.employee,
    },
    ...over,
  });

  it('allows SUPERVISOR to access detail of employee in same unit', async () => {
    const reviewer = { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } };
    const prisma = {
      employee: { findUnique: vi.fn(async (a: any) => (a.where?.userId === 'u-sup' ? reviewer : null)) },
      attendance: { findUnique: vi.fn(async () => row()) },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await expect(
      svcOf(prisma).getOne('a1', 'u-sup', ['SUPERVISOR']),
    ).resolves.toMatchObject({ id: 'a1' });
  });

  it('rejects SUPERVISOR accessing detail of employee in different unit', async () => {
    const reviewer = { id: 'e-sup', userId: 'u-sup', departmentId: 'd1', department: { id: 'd1', hospitalId: 'h1' } };
    const prisma = {
      employee: { findUnique: vi.fn(async (a: any) => (a.where?.userId === 'u-sup' ? reviewer : null)) },
      attendance: {
        findUnique: vi.fn(async () =>
          row({ employee: { id: 'e-target', userId: 'u-target', departmentId: 'd2', department: { id: 'd2', name: 'OK', hospitalId: 'h1' } } }),
        ),
      },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await expect(
      svcOf(prisma).getOne('a1', 'u-sup', ['SUPERVISOR']),
    ).rejects.toThrow('Attendance not found');
  });

  it('rejects SUPERVISOR with no departmentId (fail-safe)', async () => {
    const reviewer = { id: 'e-sup', userId: 'u-sup', departmentId: null, department: null };
    const prisma = {
      employee: { findUnique: vi.fn(async (a: any) => (a.where?.userId === 'u-sup' ? reviewer : null)) },
      attendance: { findUnique: vi.fn(async () => row()) },
      department: { findUnique: vi.fn() },
    } as unknown as PrismaService;

    await expect(
      svcOf(prisma).getOne('a1', 'u-sup', ['SUPERVISOR']),
    ).rejects.toThrow('Attendance not found');
  });
});
