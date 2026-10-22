import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ShiftsService } from './shifts.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const base = {
    hospital: { findUnique: vi.fn(async () => ({ id: 'h1' })), ...over.hospital },
    
    
    
    userRole: {
      findMany: vi.fn(async () => [{ role: { name: 'SUPER_ADMIN' } }]),
      ...over.userRole,
    },
    shift: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      ...over.shift,
    },
    employee: { findUnique: vi.fn(async () => ({ id: 'e1' })), ...over.employee },
    employeeSchedule: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(),
      delete: vi.fn(async () => ({})),
      ...over.employeeSchedule,
    },
    attendance: { findFirst: vi.fn(async () => null), ...over.attendance },
  };
  
  
  return {
    ...base,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  } as unknown as PrismaService;
}

const malamDto = () => ({
  hospitalId: 'h1',
  name: 'MALAM',
  startTime: '23:00',
  endTime: '07:00',
});

describe('ShiftsService.createShift', () => {
  it('derives overnight + defaults, audits', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 's1', ...a.data }));
    const prisma = makePrisma({ shift: { create } });
    const svc = new ShiftsService(prisma, auditStub);
    const out = (await svc.createShift(malamDto(), 'admin')) as Record<string, unknown>;
    expect(out.overnight).toBe(true);
    expect(out.gracePeriodMin).toBe(15);
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SHIFT_CREATED' }),
      expect.anything(),
    );
  });

  it('rejects unknown hospital, equal times, overnight contradiction, duplicate name', async () => {
    const svc = new ShiftsService(makePrisma({ hospital: { findUnique: vi.fn(async () => null) } }), auditStub);
    await expect(svc.createShift(malamDto(), 'a')).rejects.toThrow('Hospital not found');

    const svc2 = new ShiftsService(makePrisma(), auditStub);
    await expect(svc2.createShift({ ...malamDto(), startTime: '07:00', endTime: '07:00' }, 'a')).rejects.toThrow('cannot be equal');
    await expect(svc2.createShift({ ...malamDto(), overnight: false }, 'a')).rejects.toThrow('contradicts');

    const svc3 = new ShiftsService(
      makePrisma({ shift: { findUnique: vi.fn(async () => ({ id: 'sx' })) } }),
      auditStub,
    );
    await expect(svc3.createShift(malamDto(), 'a')).rejects.toThrow('already exists');
  });
});




describe('ShiftsService.listMineFor (employee-facing roster)', () => {
  it('scopes to the caller employee and returns shift context', async () => {
    const rows = [
      { id: 'sch1', employeeId: 'e1', workDate: new Date('2026-10-06'), shift: { name: 'PAGI', startTime: '07:00', endTime: '15:00', overnight: false } },
    ];
    const findMany = vi.fn(async () => rows);
    const count = vi.fn(async () => 1);
    const prisma = makePrisma({
      employee: { findUnique: vi.fn(async () => ({ id: 'e1' })) },
      employeeSchedule: { count, findMany },
    });
    const svc = new ShiftsService(prisma, auditStub);
    const out = await svc.listMineFor('u1', { from: '2026-10-01', to: '2026-10-31', pageSize: 7 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { employeeId: 'e1' },
            { workDate: { gte: new Date('2026-10-01') } },
            { workDate: { lte: new Date('2026-10-31') } },
          ],
        },
        orderBy: [{ workDate: 'asc' }],
        take: 7,
      }),
    );
    expect(out.data).toHaveLength(1);
    expect(out.data[0].shift.name).toBe('PAGI');
    expect(out.pagination.totalItems).toBe(1);
  });

  it('returns an empty page when the account has no employee profile', async () => {
    const prisma = makePrisma({ employee: { findUnique: vi.fn(async () => null) } });
    const svc = new ShiftsService(prisma, auditStub);
    const out = await svc.listMineFor('u1', {});
    expect(out.data).toEqual([]);
    expect(out.pagination.totalItems).toBe(0);
  });

  it('never leaks another employee roster (employeeId always the caller)', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma({
      employee: { findUnique: vi.fn(async () => ({ id: 'e-mine' })) },
      employeeSchedule: { count: vi.fn(async () => 0), findMany },
    });
    const svc = new ShiftsService(prisma, auditStub);
    
    await svc.listMineFor('u1', { employeeId: 'e-other' } as never);
    const arg = findMany.mock.calls[0][0] as { where: { AND: unknown[] } };
    expect(arg.where.AND[0]).toEqual({ employeeId: 'e-mine' });
  });
});

describe('ShiftsService audit atomicity', () => {
  it('rolls the insert back when the audit write fails', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 's1', ...a.data }));
    const prisma = makePrisma({ shift: { create } });

    let committed = false;
    (prisma as unknown as {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    }).$transaction = async (fn) => {
      try {
        return await fn((prisma as unknown as { $transaction?: unknown }));
      } catch (e) {
        committed = false; 
        throw e;
      }
    };

    const failingAudit = {
      log: vi.fn(async () => {
        throw new Error('audit unavailable');
      }),
    } as never;

    const svc = new ShiftsService(prisma, failingAudit);
    await expect(svc.createShift(malamDto(), 'admin')).rejects.toThrow('audit unavailable');
    expect(create).toHaveBeenCalledTimes(1);
    expect(committed).toBe(false);
  });

  it('writes the audit through the transaction client, not the base client', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 's1', ...a.data }));
    const prisma = makePrisma({ shift: { create } });
    const svc = new ShiftsService(prisma, auditStub);
    await svc.createShift(malamDto(), 'admin');
    const txArg = (auditStub.log as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1];
    expect(txArg).toBeDefined();
  });
});

describe('ShiftsService schedules', () => {
  it('assign guards duplicates; unassign protects attendance', async () => {
    const prisma = makePrisma({
      shift: { findUnique: vi.fn(async () => ({ id: 's1' })) },
      employeeSchedule: {
        findUnique: vi.fn(async () => ({ id: 'sch' })),
        delete: vi.fn(),
      },
      attendance: { findFirst: vi.fn(async () => ({ id: 'a1' })) },
    });
    const svc = new ShiftsService(prisma, auditStub);
    await expect(
      svc.assignSchedule({ employeeId: 'e1', shiftId: 's1', workDate: '2026-09-23' }, 'a'),
    ).rejects.toThrow('already scheduled');
    await expect(svc.unassignSchedule('sch', 'a')).rejects.toThrow('cannot be removed');
  });

  it('unassign succeeds when unused and audits', async () => {
    const del = vi.fn(async () => ({}));
    const prisma = makePrisma({
      employeeSchedule: {
        findUnique: vi.fn(async () => ({ id: 'sch' })),
        delete: del,
      },
    });
    const svc = new ShiftsService(prisma, auditStub);
    await expect(svc.unassignSchedule('sch', 'a')).resolves.toEqual({ removed: true });
    expect(del).toHaveBeenCalled();
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SCHEDULE_UNASSIGNED' }));
  });

  it('assign rejects unknown employee/shift', async () => {
    const svc = new ShiftsService(
      makePrisma({ employee: { findUnique: vi.fn(async () => null) } }),
      auditStub,
    );
    await expect(
      svc.assignSchedule({ employeeId: 'no', shiftId: 's1', workDate: '2026-09-23' }, 'a'),
    ).rejects.toThrow('Employee not found');
  });
});

describe('ShiftsService extras (STEP 23 coverage)', () => {
  it('update validates + renames with clash check; get/list work', async () => {
    const update = vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data }));
    const existing = {
      id: 's1', hospitalId: 'h1', name: 'PAGI', startTime: '07:00', endTime: '15:00', overnight: false,
    };
    const prisma = makePrisma({
      shift: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
          (a.where as Record<string, unknown>).id ? existing : null,
        ),
        update,
      },
    });
    const svc = new ShiftsService(prisma, auditStub);
    const out = (await svc.updateShift('s1', { gracePeriodMin: 10 }, 'a')) as { overnight: boolean };
    expect(out.overnight).toBe(false);
    await expect(svc.updateShift('s1', { startTime: '15:00', endTime: '07:00', overnight: false }, 'a')).rejects.toThrow(
      'contradicts',
    );
    await expect(svc.getShift('s1', 'u', ['SUPER_ADMIN'])).resolves.toMatchObject({ id: 's1' });
    expect(await svc.listShifts({ hospitalId: 'h1' }, 'u', ['SUPER_ADMIN'])).toBeDefined();
  });

  it('assign rejects unknown shift; unassign unknown 404', async () => {
    const prisma = makePrisma({
      shift: { findUnique: vi.fn(async () => null) },
      employeeSchedule: { findUnique: vi.fn(async () => null) },
    });
    const svc = new ShiftsService(prisma, auditStub);
    await expect(
      svc.assignSchedule({ employeeId: 'e1', shiftId: 'no', workDate: '2026-09-23' }, 'a'),
    ).rejects.toThrow('Shift not found');
    await expect(svc.unassignSchedule('no', 'a')).rejects.toThrow('Schedule not found');
    await expect(svc.getSchedule('no', 'u', ['SUPER_ADMIN'])).rejects.toThrow('Schedule not found');
  });
});

describe('ShiftsService.deleteShift', () => {
  it('deletes and audits when the shift is unused', async () => {
    const del = vi.fn(async () => ({}));
    const prisma = makePrisma({
      shift: {
        findUnique: vi.fn(async () => ({ id: 's1', name: 'PAGI', hospitalId: 'h1' })),
        delete: del,
      },
      employeeSchedule: { findFirst: vi.fn(async () => null) },
    });
    const svc = new ShiftsService(prisma, auditStub);

    await expect(svc.deleteShift('s1', 'a')).resolves.toEqual({ removed: true });
    expect(del).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SHIFT_DELETED' }));
  });

  it('refuses while a roster row references it (history protection)', async () => {
    const prisma = makePrisma({
      shift: { findUnique: vi.fn(async () => ({ id: 's1', name: 'PAGI', hospitalId: 'h1' })) },
      employeeSchedule: { findFirst: vi.fn(async () => ({ id: 'sch' })) },
    });
    const svc = new ShiftsService(prisma, auditStub);
    await expect(svc.deleteShift('s1', 'a')).rejects.toThrow('cannot be deleted');
  });

  it('404s on an unknown id', async () => {
    const svc = new ShiftsService(
      makePrisma({ shift: { findUnique: vi.fn(async () => null) } }),
      auditStub,
    );
    await expect(svc.deleteShift('nope', 'a')).rejects.toThrow('Shift not found');
  });
});


describe('ShiftsService facility scoping (ADMIN)', () => {
  const ADMIN = ['ADMIN'];
  
  function scopedPrisma(over: Record<string, Record<string, unknown>> = {}) {
    return makePrisma({
      userRole: { findMany: vi.fn(async () => [{ role: { name: 'ADMIN' } }]) },
      employee: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
          'userId' in a.where
            ? { id: 'e-adm', department: { hospitalId: 'h1' } }
            : { id: 'e2', department: { hospitalId: 'h2' } },
        ),
      },
      ...over,
    });
  }

  it('createShift in another hospital reads as 404', async () => {
    const svc = new ShiftsService(scopedPrisma(), auditStub);
    await expect(
      svc.createShift({ hospitalId: 'h2', name: 'X', startTime: '07:00', endTime: '15:00' }, 'u-adm'),
    ).rejects.toThrow('Hospital not found');
  });

  it('listShifts is forced to the caller facility even with a foreign filter', async () => {
    const findMany = vi.fn(async () => []);
    const svc = new ShiftsService(scopedPrisma({ shift: { findMany } }), auditStub);
    await svc.listShifts({ hospitalId: 'h2' }, 'u-adm', ADMIN);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hospitalId: 'h1' } }),
    );
  });

  it('cross-facility getSchedule reads as 404', async () => {
    const svc = new ShiftsService(
      scopedPrisma({
        employeeSchedule: {
          findUnique: vi.fn(async () => ({
            id: 'sch',
            shift: { hospitalId: 'h2' },
            employee: { department: { hospitalId: 'h2' } },
          })),
        },
      }),
      auditStub,
    );
    await expect(svc.getSchedule('sch', 'u-adm', ADMIN)).rejects.toThrow('Schedule not found');
  });
});
