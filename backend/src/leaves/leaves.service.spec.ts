import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LeavesService } from './leaves.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const byId: Record<
    string,
    {
      id: string;
      supervisorId: string | null;
      departmentId: string | null;
      department: { hospitalId: string } | null;
    }
  > = {
    'e-emp': {
      id: 'e-emp',
      supervisorId: null,
      departmentId: 'd1',
      department: { hospitalId: 'h1' },
    },
    'e-sup': {
      id: 'e-sup',
      supervisorId: null,
      departmentId: 'd1',
      department: { hospitalId: 'h1' },
    },
    'e-other': {
      id: 'e-other',
      supervisorId: null,
      departmentId: 'd2',
      department: { hospitalId: 'h1' },
    },
  };
  const byUser: Record<string, string> = {
    'u-emp': 'e-emp',
    'u-sup': 'e-sup',
    'u-other': 'e-other',
  };
  return {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, string> }) =>
        a.where.id
          ? (byId[a.where.id] ?? null)
          : (byId[byUser[a.where.userId]] ?? null),
      ),
      ...over.employee,
    },
    leaveRequest: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (a: { data: object }) => ({
        id: 'l1',
        status: 'PENDING',
        ...a.data,
      })),
      update: vi.fn(async (a: { where: { id: string }; data: object }) => ({
        id: a.where.id,
        ...a.data,
      })),
      ...over.leave,
    },
  } as unknown as PrismaService;
}

const svcOf = (prisma: PrismaService) => new LeavesService(prisma, auditStub);
const dto = (over: Record<string, unknown> = {}) => ({
  type: 'CUTI',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  reason: 'Acara keluarga',
  ...over,
});

describe('LeavesService.create', () => {
  it('creates + audits; guards inverted range and overlap', async () => {
    const out = (await svcOf(makePrisma()).create(dto(), 'u-emp')) as {
      status: string;
    };
    expect(out.status).toBe('PENDING');
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LEAVE_CREATED' }),
    );

    await expect(
      svcOf(makePrisma()).create(
        dto({ startDate: '2026-10-12', endDate: '2026-10-10' }),
        'u-emp',
      ),
    ).rejects.toMatchObject({ response: { reason: 'INVERTED_RANGE' } });

    const clash = makePrisma({
      leave: { findFirst: vi.fn(async () => ({ id: 'l0' })) },
    });
    await expect(svcOf(clash).create(dto(), 'u-emp')).rejects.toThrow(
      'Overlapping',
    );
  });
});

describe('LeavesService review', () => {
  const pending = { id: 'l1', status: 'PENDING', employeeId: 'e-emp' };

  it('supervisor approves/rejects within same unit + audits; outsider/employee denied', async () => {
    const prisma = makePrisma({
      leave: { findUnique: vi.fn(async () => pending) },
    });
    const out = (await svcOf(prisma).approve(
      'l1',
      'u-sup',
      ['SUPERVISOR'],
      'ok',
    )) as { status: string };
    expect(out.status).toBe('APPROVED');
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LEAVE_APPROVED' }),
    );

    const rej = makePrisma({
      leave: { findUnique: vi.fn(async () => pending) },
    });
    await expect(
      svcOf(rej).reject('l1', 'u-sup', ['SUPERVISOR'], 'kurang'),
    ).resolves.toMatchObject({ status: 'REJECTED' });

    const other = makePrisma({
      leave: { findUnique: vi.fn(async () => pending) },
    });
    await expect(
      svcOf(other).approve('l1', 'u-other', ['SUPERVISOR']),
    ).rejects.toThrow('Not authorized');
    await expect(
      svcOf(other).reject('l1', 'u-emp', ['EMPLOYEE']),
    ).rejects.toThrow('pengajuan sendiri');
  });

  it('team queue scopes non-admin to unit; double review blocked', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma({ leave: { findMany } });
    await svcOf(prisma).listQueue('u-sup', ['SUPERVISOR'], {});
    const where = findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"departmentId":"d1"');
    expect(JSON.stringify(where)).not.toContain('supervisorId');

    const done = makePrisma({
      leave: {
        findUnique: vi.fn(async () => ({ ...pending, status: 'APPROVED' })),
      },
    });
    await expect(
      svcOf(done).approve('l1', 'u-sup', ['SUPERVISOR']),
    ).rejects.toThrow('already reviewed');
  });
});

describe('LeavesService extras (STEP 23 coverage)', () => {
  it('cancel is owner/pending-only; reject audits', async () => {
    const update = vi.fn(
      async (a: { where: { id: string }; data: object }) => ({
        id: a.where.id,
        ...a.data,
      }),
    );
    const pending = { id: 'l1', status: 'PENDING', employeeId: 'e-emp' };
    const prisma = makePrisma({
      leave: { findUnique: vi.fn(async () => pending), update },
    });
    const svc = svcOf(prisma);
    await expect(
      svc.reject('l1', 'u-sup', ['SUPERVISOR'], 'penuh'),
    ).resolves.toMatchObject({ status: 'REJECTED' });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LEAVE_REJECTED' }),
    );
    await expect(svc.cancel('l1', 'u-emp')).resolves.toMatchObject({
      status: 'CANCELLED',
    });

    const other = makePrisma({
      employee: {
        findUnique: vi.fn(async () => ({ id: 'e-other', supervisorId: null })),
      },
      leave: { findUnique: vi.fn(async () => pending) },
    });
    await expect(svcOf(other).cancel('l1', 'u-other')).rejects.toThrow(
      'not found',
    );
  });

  it('listMine/listQueue scope correctly', async () => {
    const findMany = vi.fn(async () => [{ id: 'l1' }]);
    const prisma = makePrisma({ leave: { findMany } });
    const svc = svcOf(prisma);
    await svc.listMine('u-emp');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 'e-emp' }),
      }),
    );
    await svc.listQueue('u-sup', ['SUPERVISOR'], { status: 'PENDING' });
    const q = findMany.mock.calls[1][0].where;
    expect(JSON.stringify(q)).toContain('PENDING');
    expect(JSON.stringify(q)).toContain('"departmentId":"d1"');
    expect(JSON.stringify(q)).not.toContain('supervisorId');
  });
});
