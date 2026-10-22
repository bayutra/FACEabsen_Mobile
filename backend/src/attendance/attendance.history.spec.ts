import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AttendanceService } from './attendance.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;
const configStub = { get: (_k: string, d: unknown) => d } as never;
const depsStub = {} as never;

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  return {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
        'userId' in a.where
          ? { id: 'e1', department: { hospitalId: 'h1' } }
          : { id: 'e1' },
      ),
      ...over.employee,
    },
    attendance: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      create: vi.fn(),
      update: vi.fn(),
      ...over.attendance,
    },
    department: { findUnique: vi.fn(async () => null), ...over.department },
  } as unknown as PrismaService;
}

const svcOf = (prisma: PrismaService) =>
  new AttendanceService(
    prisma,
    depsStub,
    depsStub,
    depsStub,
    depsStub,
    auditStub,
    configStub,
  );

describe('AttendanceService.listMine', () => {
  it('scopes to caller + envelope + no profile 404', async () => {
    const findMany = vi.fn(async () => [{ id: 'a1' }]);
    const prisma = makePrisma({
      attendance: { count: vi.fn(async () => 1), findMany },
    });
    const svc = svcOf(prisma);
    const out = await svc.listMine('u1', { page: 1, pageSize: 20 });
    expect(out.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ employeeId: 'e1' }]),
        }),
      }),
    );

    const svc2 = svcOf(
      makePrisma({ employee: { findUnique: vi.fn(async () => null) } }),
    );
    await expect(svc2.listMine('ghost', {})).rejects.toThrow(
      'No employee profile',
    );
  });

  it('passes date/status filters', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma({ attendance: { findMany } });
    await svcOf(prisma).listMine('u1', {
      from: '2026-10-01',
      to: '2026-10-05',
      checkInStatus: 'LATE',
    });
    const where = findMany.mock.calls[0][0].where as { AND: unknown[] };
    expect(where.AND).toHaveLength(4);
  });
});

describe('AttendanceService.listAll', () => {
  it('builds admin filters incl. search + needsReview', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma({ attendance: { findMany } });
    await svcOf(prisma).listAll(
      {
        search: 'siti',
        departmentId: 'd1',
        needsReview: true,
        riskCategory: 'MEDIUM',
      },
      'u',
      ['SUPER_ADMIN'],
    );
    const where = findMany.mock.calls[0][0].where as { AND: unknown[] };
    expect(where.AND).toHaveLength(4);
    expect(JSON.stringify(where)).toContain('siti');
  });

  it('ADMIN is confined to the caller facility; foreign department reads empty', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma({
      attendance: { findMany },
      department: { findUnique: vi.fn(async () => ({ hospitalId: 'h2' })) },
    });
    const out = await svcOf(prisma).listAll({ departmentId: 'd9' }, 'u-adm', [
      'ADMIN',
    ]);
    expect(out.pagination.totalItems).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('AttendanceService.getOne', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    employee: {
      id: 'e1',
      userId: 'u1',
      name: 'Siti',
      employeeNo: 'EMP-001',
      department: { id: 'd1', name: 'IGD', hospitalId: 'h1' },
    },
    ...over,
  });

  it('owner and admin pass; stranger and unknown get 404', async () => {
    const prisma = makePrisma({
      attendance: { findUnique: vi.fn(async () => row()) },
    });
    const svc = svcOf(prisma);
    await expect(svc.getOne('a1', 'u1', ['EMPLOYEE'])).resolves.toMatchObject({
      id: 'a1',
    });
    await expect(svc.getOne('a1', 'u9', ['ADMIN'])).resolves.toMatchObject({
      id: 'a1',
    });
    await expect(
      svc.getOne('a1', 'u9', ['SUPER_ADMIN']),
    ).resolves.toMatchObject({ id: 'a1' });
    await expect(svc.getOne('a1', 'u9', ['EMPLOYEE'])).rejects.toThrow(
      'Attendance not found',
    );

    const svc2 = svcOf(
      makePrisma({ attendance: { findUnique: vi.fn(async () => null) } }),
    );
    await expect(svc2.getOne('nope', 'u1', ['ADMIN'])).rejects.toThrow(
      'Attendance not found',
    );
  });

  it('ADMIN of another facility gets 404 on a foreign row', async () => {
    const prisma = makePrisma({
      attendance: {
        findUnique: vi.fn(async () =>
          row({
            employee: {
              id: 'e9',
              userId: 'u9x',
              department: { hospitalId: 'h2' },
            },
          }),
        ),
      },
    });

    await expect(
      svcOf(prisma).getOne('a1', 'u-adm', ['ADMIN']),
    ).rejects.toThrow('Attendance not found');
  });
});
