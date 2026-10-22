import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CorrectionsService } from './corrections.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;

const SHIFT = {
  id: 's1', name: 'PAGI', startTime: '07:00', endTime: '15:00', overnight: false,
  gracePeriodMin: 15, lateThresholdMin: 30, earlyCheckoutThresholdMin: 15,
};

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const byId: Record<string, { id: string; supervisorId: string | null }> = {
    'e-emp': { id: 'e-emp', supervisorId: 'e-sup' },
    'e-sup': { id: 'e-sup', supervisorId: null },
    'e-other': { id: 'e-other', supervisorId: null },
  };
  const byUser: Record<string, string> = { 'u-emp': 'e-emp', 'u-sup': 'e-sup', 'u-other': 'e-other' };
  const base = {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, string> }) =>
        a.where.id ? (byId[a.where.id] ?? null) : byId[byUser[a.where.userId]] ?? null,
      ),
      ...over.employee,
    },
    attendance: {
      findUnique: vi.fn(async () => ({
        id: 'a1', employeeId: 'e-emp', workDate: new Date('2026-10-05T00:00:00.000Z'), shift: SHIFT,
      })),
      update: vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data })),
      ...over.attendance,
    },
    correctionRequest: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (a: { data: object }) => ({ id: 'c1', status: 'PENDING', ...a.data })),
      update: vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data })),
      findMany: vi.fn(async () => []),
      ...over.correction,
    },
  };
  
  return { ...base, $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(base)) } as unknown as PrismaService;
}

const svcOf = (prisma: PrismaService) => new CorrectionsService(prisma, auditStub);

const dto = (over: Record<string, unknown> = {}) => ({
  attendanceId: 'a1',
  type: 'MISSED_CHECK_OUT',
  requestedCheckOut: '2026-10-05T15:05:00.000Z',
  reason: 'Lupa tap pulang',
  ...over,
});

describe('CorrectionsService.create', () => {
  it('creates + audits; guards duplicates/foreign/empty', async () => {
    const prisma = makePrisma();
    const out = (await svcOf(prisma).create(dto(), 'u-emp')) as { status: string };
    expect(out.status).toBe('PENDING');
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CORRECTION_CREATED' }));

    const dup = makePrisma({ correction: { findFirst: vi.fn(async () => ({ id: 'c0' })) } });
    await expect(svcOf(dup).create(dto(), 'u-emp')).rejects.toThrow('already exists');

    const foreign = makePrisma({
      attendance: { findUnique: vi.fn(async () => ({ id: 'ax', employeeId: 'e-other' })) },
    });
    await expect(svcOf(foreign).create(dto(), 'u-emp')).rejects.toThrow('Attendance not found');

    await expect(svcOf(makePrisma()).create({ ...dto(), requestedCheckOut: undefined }, 'u-emp')).rejects.toMatchObject(
      { response: { reason: 'NOTHING_TO_CORRECT' } },
    );
  });
});

describe('CorrectionsService review scope', () => {
  const pending = {
    id: 'c1', status: 'PENDING', employeeId: 'e-emp', attendanceId: 'a1',
    requestedCheckIn: null, requestedCheckOut: new Date('2026-10-05T15:05:00.000Z'),
    attendance: {
      id: 'a1', employeeId: 'e-emp', workDate: new Date('2026-10-05T00:00:00.000Z'), shift: SHIFT,
    },
  };

  it('supervisor approves: attendance recomputed + audited', async () => {
    const attUpdate = vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data }));
    const prisma = makePrisma({
      correction: { findUnique: vi.fn(async () => pending) },
      attendance: {
        findUnique: vi.fn(async () => pending.attendance),
        update: attUpdate,
      },
    });
    const out = (await svcOf(prisma).approve('c1', 'u-sup', ['SUPERVISOR'], 'ok')) as { status: string };
    expect(out.status).toBe('APPROVED');
    
    expect(attUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ checkOutStatus: 'NORMAL_CHECKOUT' }) }),
    );
    
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CORRECTION_APPROVED' }),
      expect.anything(),
    );
  });

  it('stranger supervisor and employee cannot review; double review blocked', async () => {
    const prisma = makePrisma({ correction: { findUnique: vi.fn(async () => pending) } });
    const svc = svcOf(prisma);
    
    const other = makePrisma({ correction: { findUnique: vi.fn(async () => pending) } });
    await expect(svcOf(other).approve('c1', 'u-other', ['SUPERVISOR'])).rejects.toThrow('Not authorized');
    await expect(svc.approve('c1', 'u-emp', ['EMPLOYEE'])).rejects.toThrow();
  });

  it('off-day correction instants are rejected (Tahap 3 L5)', async () => {
    
    
    const wibMorning = {
      ...pending,
      requestedCheckIn: new Date('2026-10-04T23:55:00.000Z'),
      requestedCheckOut: null,
    };
    const prisma = makePrisma({ correction: { findUnique: vi.fn(async () => wibMorning) } });
    await expect(svcOf(prisma).approve('c1', 'u-sup', ['SUPERVISOR'])).resolves.toBeDefined();

    const offDay = {
      ...pending,
      requestedCheckIn: new Date('2026-10-06T01:00:00.000Z'), 
      requestedCheckOut: null,
    };
    const prisma2 = makePrisma({ correction: { findUnique: vi.fn(async () => offDay) } });
    await expect(svcOf(prisma2).approve('c1', 'u-sup', ['SUPERVISOR'])).rejects.toMatchObject({
      response: { reason: 'CORRECTION_OFF_DAY' },
    });
  });
});

describe('CorrectionsService extras (STEP 23 coverage)', () => {
  it('reject flips + audits; cancel is owner/pending-only', async () => {
    const update = vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data }));
    const pending = { id: 'c1', status: 'PENDING', employeeId: 'e-emp' };
    const prisma = makePrisma({ correction: { findUnique: vi.fn(async () => pending), update } });
    const svc = svcOf(prisma);
    await expect(svc.reject('c1', 'u-sup', ['SUPERVISOR'], 'kurang bukti')).resolves.toMatchObject({ status: 'REJECTED' });
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CORRECTION_REJECTED' }));
    await expect(svc.cancel('c1', 'u-emp')).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('listMine/listQueue scope correctly', async () => {
    const findMany = vi.fn(async () => [{ id: 'c1' }]);
    const prisma = makePrisma({ correction: { findMany } });
    const svc = svcOf(prisma);
    await svc.listMine('u-emp');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employeeId: 'e-emp' }) }));
    await svc.listQueue('u-sup', ['SUPERVISOR'], { status: 'PENDING' });
    const q = findMany.mock.calls[1][0].where;
    expect(JSON.stringify(q)).toContain('PENDING');
  });
});
