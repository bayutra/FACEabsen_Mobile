import * as argon2 from 'argon2';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DeviceChangeService } from './device-change.service.js';

let HASH = '';
beforeAll(async () => {
  HASH = await argon2.hash('Password123!');
});

const auditStub = { log: vi.fn(async () => undefined) } as never;

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const tx = {
    device: { update: vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data })) },
    session: { updateMany: vi.fn(async () => ({ count: 1 })) },
    deviceChangeRequest: { update: vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data })) },
  };
  return {
    __tx: tx,
    employee: {
      findUnique: vi.fn(async () => ({
        id: 'e1',
        user: { id: 'u1', passwordHash: HASH },
      })),
      ...over.employee,
    },
    device: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      ...over.device,
    },
    deviceChangeRequest: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(),
      update: vi.fn(),
      ...over.deviceChange,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaService;
}

const dto = (over: Record<string, unknown> = {}) => ({
  newDeviceId: 'd2',
  reason: 'BROKEN' as const,
  password: 'Password123!',
  ...over,
});

const oldActive = { id: 'd1', employeeId: 'e1', status: 'ACTIVE' };
const newPending = { id: 'd2', employeeId: 'e1', status: 'PENDING' };

describe('DeviceChangeService.request', () => {
  it('creates PENDING request + audits', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'r1', status: 'PENDING', ...a.data }));
    const prisma = makePrisma({
      device: {
        findFirst: vi.fn(async () => oldActive),
        findUnique: vi.fn(async () => newPending),
      },
      deviceChange: { create },
    });
    const svc = new DeviceChangeService(prisma, auditStub);
    const out = (await svc.request(dto(), 'u1')) as { status: string };
    expect(out.status).toBe('PENDING');
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEVICE_REPLACEMENT_REQUESTED' }),
    );
  });

  it('wrong password -> 401; no active -> 409; wrong new device states', async () => {
    const base = {
      device: {
        findFirst: vi.fn(async () => oldActive),
        findUnique: vi.fn(async () => newPending),
      },
    };
    const svc = new DeviceChangeService(makePrisma(base), auditStub);
    await expect(svc.request(dto({ password: 'Nope1234!' }), 'u1')).rejects.toThrow('Identity verification failed');

    const svc2 = new DeviceChangeService(
      makePrisma({ device: { findFirst: vi.fn(async () => null), findUnique: vi.fn(async () => newPending) } }),
      auditStub,
    );
    await expect(svc2.request(dto(), 'u1')).rejects.toThrow('No active device');

    const svc3 = new DeviceChangeService(
      makePrisma({
        device: {
          findFirst: vi.fn(async () => oldActive),
          findUnique: vi.fn(async () => ({ ...newPending, employeeId: 'e9' })),
        },
      }),
      auditStub,
    );
    await expect(svc3.request(dto(), 'u1')).rejects.toThrow('New device not found');

    const svc4 = new DeviceChangeService(
      makePrisma({
        device: {
          findFirst: vi.fn(async () => oldActive),
          findUnique: vi.fn(async () => ({ ...newPending, status: 'REVOKED' })),
        },
      }),
      auditStub,
    );
    await expect(svc4.request(dto(), 'u1')).rejects.toThrow('not eligible');
  });

  it('duplicate pending request -> 409', async () => {
    const prisma = makePrisma({
      device: {
        findFirst: vi.fn(async () => oldActive),
        findUnique: vi.fn(async () => newPending),
      },
      deviceChange: { findFirst: vi.fn(async () => ({ id: 'r0' })) },
    });
    const svc = new DeviceChangeService(prisma, auditStub);
    await expect(svc.request(dto(), 'u1')).rejects.toThrow('already exists');
  });
});

describe('DeviceChangeService.approve/reject/cancel', () => {
  const pending = { id: 'r1', status: 'PENDING', employeeId: 'e1', oldDeviceId: 'd1', newDeviceId: 'd2' };

  function approvedPrisma() {
    return makePrisma({
      deviceChange: { findUnique: vi.fn(async () => pending) },
      device: {
        findUnique: vi.fn(async (a: { where: { id: string } }) =>
          a.where.id === 'd1' ? oldActive : newPending,
        ),
      },
    });
  }

  it('approve flips atomically + kills old sessions + audits x2', async () => {
    const prisma = approvedPrisma();
    const svc = new DeviceChangeService(prisma, auditStub);
    await svc.approve('r1', 'admin', ['SUPER_ADMIN'], 'ok');
    const tx = (prisma as unknown as { __tx: { device: { update: ReturnType<typeof vi.fn> }; session: { updateMany: ReturnType<typeof vi.fn> } } }).__tx;
    expect(tx.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ status: 'REVOKED' }) }),
    );
    expect(tx.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd2' }, data: { status: 'ACTIVE' } }),
    );
    expect(tx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deviceId: 'd1' }) }),
    );
    const actions = auditStub.log.mock.calls.map((c) => c[0].action);
    expect(actions).toContain('DEVICE_REPLACED');
    expect(actions).toContain('DEVICE_REVOKED');
  });

  it('approve guards: reviewed / stale devices', async () => {
    const svc = new DeviceChangeService(
      makePrisma({ deviceChange: { findUnique: vi.fn(async () => ({ ...pending, status: 'APPROVED' })) } }),
      auditStub,
    );
    await expect(svc.approve('r1', 'admin', ['SUPER_ADMIN'])).rejects.toThrow('already reviewed');

    const svc2 = new DeviceChangeService(
      makePrisma({
        deviceChange: { findUnique: vi.fn(async () => pending) },
        device: { findUnique: vi.fn(async () => ({ ...newPending, status: 'REVOKED' })) },
      }),
      auditStub,
    );
    await expect(svc2.approve('r1', 'admin', ['SUPER_ADMIN'])).rejects.toThrow('no longer eligible');
  });

  it('reject flips + audits; cancel is owner-only and pending-only', async () => {
    const update = vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data }));
    const prisma = makePrisma({ deviceChange: { findUnique: vi.fn(async () => pending), update } });
    const svc = new DeviceChangeService(prisma, auditStub);
    const rej = (await svc.reject('r1', 'admin', ['SUPER_ADMIN'], 'rusak beneran?')) as { status: string };
    expect(rej.status).toBe('REJECTED');

    const emp = { id: 'e1' };
    const prisma2 = makePrisma({
      employee: { findUnique: vi.fn(async () => emp) },
      deviceChange: { findUnique: vi.fn(async () => pending), update },
    });
    const svc2 = new DeviceChangeService(prisma2, auditStub);
    await expect(svc2.cancel('r1', 'u1')).resolves.toMatchObject({ status: 'CANCELLED' });

    const prisma3 = makePrisma({
      employee: { findUnique: vi.fn(async () => ({ id: 'e9' })) },
      deviceChange: { findUnique: vi.fn(async () => pending) },
    });
    await expect(new DeviceChangeService(prisma3, auditStub).cancel('r1', 'u9')).rejects.toThrow('not found');
  });
});

// Tahap 2 — facility scoping: an ADMIN of h1 cannot review h2's requests.
describe('DeviceChangeService facility scoping (ADMIN)', () => {
  const ADMIN = ['ADMIN'];
  const foreign = {
    id: 'r9',
    status: 'PENDING',
    employeeId: 'e9',
    oldDeviceId: 'd9',
    newDeviceId: 'd8',
    employee: { department: { hospitalId: 'h2' } },
  };

  function scopedPrisma(over: Record<string, Record<string, unknown>> = {}) {
    return makePrisma({
      employee: {
        findUnique: vi.fn(async () => ({ id: 'e-adm', department: { hospitalId: 'h1' } })),
      },
      ...over,
    });
  }

  it('foreign approve / reject read as 404', async () => {
    const svc = new DeviceChangeService(
      scopedPrisma({ deviceChange: { findUnique: vi.fn(async () => foreign) } }),
      auditStub,
    );
    await expect(svc.approve('r9', 'u-adm', ADMIN)).rejects.toThrow('Change request not found');
    await expect(svc.reject('r9', 'u-adm', ADMIN)).rejects.toThrow('Change request not found');
  });

  it('foreign listAll returns only the caller facility rows', async () => {
    const findMany = vi.fn(async () => []);
    const svc = new DeviceChangeService(
      scopedPrisma({ deviceChange: { findMany } }),
      auditStub,
    );
    await svc.listAll({}, 'u-adm', ADMIN);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ employee: { department: { hospitalId: 'h1' } } }] },
      }),
    );
  });
});
