import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { HandoversService } from './handovers.service.js';

function makeService(opts: {
  reviewer?: { id: string; departmentId: string | null; hospitalId?: string | null } | null;
  handover?: any;
  handoverList?: any[];
  updateResult?: any;
}) {
  const reviewer =
    opts.reviewer === undefined
      ? { id: 'e-sup', departmentId: 'd1', hospitalId: 'h1' }
      : opts.reviewer;
  const handover =
    opts.handover === undefined
      ? {
          id: 'h1',
          hospitalId: 'h1',
          departmentId: 'd1',
          status: 'PENDING',
          fromEmployeeId: 'e-a',
          toEmployeeId: 'e-b',
          notes: null,
          fromEmployee: { id: 'e-a', name: 'A', employeeNo: 'A1' },
          toEmployee: { id: 'e-b', name: 'B', employeeNo: 'B1' },
          department: { id: 'd1', name: 'IGD', hospitalId: 'h1' },
        }
      : opts.handover;

  const prisma = {
    employee: {
      findUnique: vi.fn(async () =>
        reviewer === null
          ? null
          : {
              id: reviewer.id,
              departmentId: reviewer.departmentId,
              department: { hospitalId: reviewer.hospitalId ?? 'h1' },
            },
      ),
    },
    handover: {
      findMany: vi.fn(async () => opts.handoverList ?? [handover]),
      findUnique: vi.fn(async () => handover),
      update: vi.fn(async () => opts.updateResult ?? { ...handover, status: 'ACKNOWLEDGED' }),
    },
  } as unknown as PrismaService;
  const audit = { log: vi.fn(async () => undefined) } as unknown as AuditService;
  const svc = new HandoversService(prisma, audit);
  return { svc, prisma, audit };
}

describe('HandoversService (SUPERVISOR unit scoping)', () => {
  it('list: supervisor sees handovers in same unit (departmentId), not by supervisorId', async () => {
    const { svc, prisma } = makeService({});
    const out = await svc.list('u-sup', ['SUPERVISOR'], {} as never);
    expect(out).toHaveLength(1);
    const q = JSON.stringify((prisma.handover.findMany as any).mock.calls[0][0]);
    expect(q).toContain('"departmentId":"d1"');
    expect(q).toContain('"hospitalId":"h1"');
    expect(q).not.toContain('supervisorId');
  });

  it('list: supervisor without employee/departmentId sees nothing (fail-safe)', async () => {
    const { svc, prisma } = makeService({ reviewer: null });
    const out = await svc.list('u-sup', ['SUPERVISOR'], {} as never);
    expect(out).toEqual([]);
    expect(prisma.handover.findMany).not.toHaveBeenCalled();
  });

  it('findOne: supervisor can view handover in same unit', async () => {
    const { svc } = makeService({});
    await expect(svc.findOne('h1', 'u-sup', ['SUPERVISOR'])).resolves.toMatchObject({ id: 'h1' });
  });

  it('findOne: supervisor cannot view handover in different unit', async () => {
    const handover = {
      id: 'h2',
      hospitalId: 'h1',
      departmentId: 'd2',
      status: 'PENDING',
      fromEmployeeId: 'e-x',
      toEmployeeId: 'e-y',
      fromEmployee: { id: 'e-x', name: 'X', employeeNo: 'X1' },
      toEmployee: { id: 'e-y', name: 'Y', employeeNo: 'Y1' },
      department: { id: 'd2', name: 'Lab', hospitalId: 'h1' },
    };
    const { svc } = makeService({ handover });
    await expect(svc.findOne('h2', 'u-sup', ['SUPERVISOR'])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('acknowledge: supervisor can acknowledge handover in same unit', async () => {
    const { svc, prisma, audit } = makeService({});
    await expect(svc.acknowledge('h1', 'u-sup', ['SUPERVISOR'], 'ok', { ip: '1.2.3.4' })).resolves.toBeDefined();
    expect(prisma.handover.update).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
  });

  it('acknowledge: supervisor cannot acknowledge handover in different unit', async () => {
    const handover = {
      id: 'h2',
      hospitalId: 'h1',
      departmentId: 'd2',
      status: 'PENDING',
      fromEmployeeId: 'e-x',
      toEmployeeId: 'e-y',
      notes: null,
      fromEmployee: { id: 'e-x', name: 'X', employeeNo: 'X1' },
      toEmployee: { id: 'e-y', name: 'Y', employeeNo: 'Y1' },
      department: { id: 'd2', name: 'Lab', hospitalId: 'h1' },
    };
    const { svc, prisma } = makeService({ handover });
    await expect(svc.acknowledge('h2', 'u-sup', ['SUPERVISOR'])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.handover.update).not.toHaveBeenCalled();
  });

  it('acknowledge: non-supervisor is forbidden', async () => {
    const { svc } = makeService({});
    await expect(svc.acknowledge('h1', 'u-emp', ['EMPLOYEE'])).rejects.toBeInstanceOf(ForbiddenException);
  });
});
