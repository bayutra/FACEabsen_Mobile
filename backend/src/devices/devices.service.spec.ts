import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DevicesService, deviceTrust } from './devices.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;

const { privateKey: TEST_PRIV, publicKey: TEST_PUB } =
  generateKeyPairSync('ed25519');
const TEST_RAW = (TEST_PUB.export({ format: 'der', type: 'spki' }) as Buffer)
  .subarray(-32)
  .toString('base64');
const TEST_NONCE = 'challenge-nonce-for-tests-001';
const signNonce = (nonce: string) =>
  sign(null, Buffer.from(nonce, 'utf8'), TEST_PRIV).toString('base64');

const jwtFor = (sub = 'u1', purpose = 'device-register') =>
  ({
    signAsync: vi.fn(async () => TEST_NONCE),
    verifyAsync: vi.fn(async () => ({ sub, purpose, jti: randomUUID() })),
  }) as never;

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const idemKeys = new Set<string>();
  const prisma = {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
        'userId' in a.where
          ? { id: 'e-adm', department: { hospitalId: 'h1' } }
          : { id: 'e1' },
      ),
      ...over.employee,
    },
    device: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(),
      update: vi.fn(
        async (a: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: a.where.id,
          ...a.data,
        }),
      ),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
      ...over.device,
    },
    session: { updateMany: vi.fn(async () => ({ count: 0 })), ...over.session },
    idempotencyKey: {
      create: vi.fn(async (a: { data: { key: string } }) => {
        if (idemKeys.has(a.data.key)) {
          throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        }
        idemKeys.add(a.data.key);
        return { ...a.data };
      }),
      ...over.idempotencyKey,
    },
  } as Record<string, unknown>;
  prisma.$transaction = vi.fn(
    async (fn: (tx: Record<string, unknown>) => unknown) => fn(prisma),
  );
  return prisma as unknown as PrismaService;
}

const dto = () => ({
  installationId: 'inst-1',
  platform: 'ANDROID' as const,
  deviceName: 'Galaxy J2',
  appVersion: '1.0.0',
  devicePublicKey: TEST_RAW,
  nonce: TEST_NONCE,
  nonceSignature: signNonce(TEST_NONCE),
});

describe('DevicesService.register', () => {
  it('first device activates immediately + audits', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: 'd1',
      ...a.data,
    }));
    const prisma = makePrisma({ device: { create } });
    const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));
    const out = (await svc.register(dto(), 'u1')) as { status: string };
    expect(out.status).toBe('ACTIVE');
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEVICE_REGISTERED', actorId: 'u1' }),
    );
  });

  it('perangkat kedua menggantikan perangkat pertama', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: 'd2',
      ...a.data,
    }));
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const sessionUpdateMany = vi.fn(async () => ({ count: 1 }));
    const push = { notifyEmployee: vi.fn() };
    const prisma = makePrisma({
      employee: { findUnique: vi.fn(async () => ({ id: 'e1' })) },
      device: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => [{ id: 'd1' }]),
        create,
        updateMany,
      },
      session: { updateMany: sessionUpdateMany },
    });
    const svc = new DevicesService(
      prisma,
      auditStub,
      jwtFor('u1'),
      undefined,
      push as never,
    );

    const out = (await svc.register(dto(), 'u1')) as {
      id: string;
      status: string;
    };

    expect(out).toMatchObject({ id: 'd2', status: 'ACTIVE' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['d1'] } },
      data: expect.objectContaining({
        status: 'REVOKED',
        revokedAt: expect.any(Date),
        revokedBy: null,
        revokeReason: 'auto-replaced-by:d2',
      }),
    });
    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: { deviceId: { in: ['d1'] }, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEVICE_REVOKED', targetId: 'd1' }),
    );
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DEVICE_REGISTERED',
        targetId: 'd2',
        metadata: expect.objectContaining({ replacedDeviceIds: ['d1'] }),
      }),
    );
    expect(push.notifyEmployee).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({
        title: 'Ganti perangkat',
        body: 'Perangkat baru telah menggantikan perangkat lama',
      }),
    );
  });

  it('clash PENDING diaktifkan tanpa membuat baris baru', async () => {
    const create = vi.fn();
    const update = vi.fn(
      async (a: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: a.where.id,
        ...a.data,
      }),
    );
    const prisma = makePrisma({
      employee: { findUnique: vi.fn(async () => ({ id: 'e1' })) },
      device: {
        findFirst: vi.fn(async () => ({
          id: 'd2',
          employeeId: 'e1',
          status: 'PENDING',
        })),
        findMany: vi.fn(async () => []),
        update,
        create,
      },
    });
    const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));

    const out = (await svc.register(dto(), 'u1')) as {
      id: string;
      status: string;
    };

    expect(out).toMatchObject({ id: 'd2', status: 'ACTIVE' });
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'd2' },
      data: expect.objectContaining({ status: 'ACTIVE' }),
    });
  });

  it.each(['REVOKED', 'LOST', 'REPLACED'])(
    'clash %s milik sendiri -> 409 agar mobile daftar ulang',
    async (status) => {
      const prisma = makePrisma({
        device: {
          findFirst: vi.fn(async () => ({
            id: 'd1',
            employeeId: 'e1',
            status,
          })),
        },
      });
      const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));

      await expect(svc.register(dto(), 'u1')).rejects.toThrow(
        'already registered',
      );
    },
  );

  it('clash ACTIVE milik sendiri tetap idempotent tapi mencabut aktif lain', async () => {
    const create = vi.fn();
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = makePrisma({
      employee: { findUnique: vi.fn(async () => ({ id: 'e1' })) },
      device: {
        findFirst: vi.fn(async () => ({
          id: 'd1',
          employeeId: 'e1',
          status: 'ACTIVE',
        })),
        findMany: vi.fn(async () => [{ id: 'd2' }]),
        updateMany,
        create,
      },
    });
    const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));

    await expect(svc.register(dto(), 'u1')).resolves.toMatchObject({
      id: 'd1',
      status: 'ACTIVE',
    });
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['d2'] } } }),
    );
  });

  it('duplicate installationId -> 409; no employee profile -> 404', async () => {
    const prisma = makePrisma({
      device: { findFirst: vi.fn(async () => ({ id: 'dx' })) },
    });
    const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));
    await expect(svc.register(dto(), 'u1')).rejects.toThrow(
      'already registered',
    );
    const updateMany = (
      prisma as unknown as {
        device: { updateMany: ReturnType<typeof vi.fn> };
      }
    ).device.updateMany;
    expect(updateMany).not.toHaveBeenCalled();

    const svc2 = new DevicesService(
      makePrisma({ employee: { findUnique: vi.fn(async () => null) } }),
      auditStub,
      jwtFor('ghost'),
    );
    await expect(svc2.register(dto(), 'ghost')).rejects.toThrow(
      'No employee profile',
    );
  });

  it('same-owner re-register is idempotent; foreign clash stays 409', async () => {
    const create = vi.fn();
    const sameOwner = makePrisma({
      employee: {
        findUnique: vi.fn(async () => ({
          id: 'e1',
          department: { hospitalId: 'h1' },
        })),
      },
      device: {
        findFirst: vi.fn(async () => ({
          id: 'd1',
          employeeId: 'e1',
          status: 'ACTIVE',
        })),
        create,
      },
    });
    const svc = new DevicesService(sameOwner, auditStub, jwtFor('u1'));

    await expect(svc.register(dto(), 'u1')).resolves.toMatchObject({
      id: 'd1',
      status: 'ACTIVE',
    });
    expect(create).not.toHaveBeenCalled();

    const foreign = makePrisma({
      device: {
        findFirst: vi.fn(async () => ({
          id: 'dx',
          employeeId: 'e9',
          status: 'ACTIVE',
        })),
      },
    });
    const svc2 = new DevicesService(foreign, auditStub, jwtFor('u1'));
    await expect(svc2.register(dto(), 'u1')).rejects.toThrow(
      'already registered',
    );
  });

  it('bad signature -> 401 INVALID_REGISTRATION_PROOF', async () => {
    const svc = new DevicesService(makePrisma(), auditStub, jwtFor('u1'));
    const tampered = {
      ...dto(),
      nonceSignature: signNonce('forged-nonce-value-xyz'),
    };
    await expect(svc.register(tampered, 'u1')).rejects.toThrow(
      'INVALID_REGISTRATION_PROOF',
    );
  });

  it('expired challenge (verify throws) -> 401', async () => {
    const jwt = jwtFor('u1');
    (jwt.verifyAsync as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('jwt expired'),
    );
    const svc = new DevicesService(makePrisma(), auditStub, jwt);
    await expect(svc.register(dto(), 'u1')).rejects.toThrow(
      'INVALID_REGISTRATION_PROOF',
    );
  });

  it('wrong-purpose challenge (e.g. access token reuse) -> 401', async () => {
    const svc = new DevicesService(
      makePrisma(),
      auditStub,
      jwtFor('u1', 'totp'),
    );
    await expect(svc.register(dto(), 'u1')).rejects.toThrow(
      'INVALID_REGISTRATION_PROOF',
    );
  });

  it('forged nonce (challenge bound to another user) -> 401', async () => {
    const svc = new DevicesService(makePrisma(), auditStub, jwtFor('u-other'));
    await expect(svc.register(dto(), 'u1')).rejects.toThrow(
      'INVALID_REGISTRATION_PROOF',
    );
  });

  it('replayed registration proof (same jti) -> 401', async () => {
    const jwt = {
      signAsync: vi.fn(async () => TEST_NONCE),
      verifyAsync: vi.fn(async () => ({
        sub: 'u1',
        purpose: 'device-register',
        jti: 'fixed-jti-replay',
      })),
    } as never;
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: 'd1',
      ...a.data,
    }));
    const svc = new DevicesService(
      makePrisma({ device: { create } }),
      auditStub,
      jwt,
    );
    await svc.register(dto(), 'u1');
    await expect(svc.register(dto(), 'u1')).rejects.toThrow(
      'INVALID_REGISTRATION_PROOF',
    );
  });

  it('challenge round-trips through the real JwtService (stateless, no DB)', async () => {
    const { JwtService } = await import('@nestjs/jwt');
    const jwt = new JwtService({
      secret: 'unit-test-secret',
      signOptions: { algorithm: 'HS256', issuer: 'face-absen' },
    });
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: 'd1',
      ...a.data,
    }));
    const svc = new DevicesService(
      makePrisma({ device: { create } }),
      auditStub,
      jwt as never,
    );
    const { nonce, expiresAt } = await svc.issueRegisterChallenge('u1');
    expect(typeof nonce).toBe('string');
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    const out = (await svc.register(
      { ...dto(), nonce, nonceSignature: signNonce(nonce) },
      'u1',
    )) as {
      status: string;
    };
    expect(out.status).toBe('ACTIVE');
  });
});

describe('DevicesService admin (STEP 18)', () => {
  const active = {
    id: 'd1',
    employeeId: 'e1',
    status: 'ACTIVE',
    deviceName: 'Galaxy',
    appVersion: '1.0.0',
    installationId: 'inst-1',
    platform: 'ANDROID',
    lastSeenAt: new Date(),
  };

  it('listAll builds envelope + filters and annotates trust', async () => {
    const findMany = vi.fn(async () => [active]);
    const prisma = makePrisma({
      device: {
        findMany,
        count: vi.fn(async () => 1),
      } as never,
    });
    const svc = new DevicesService(prisma, auditStub);
    const out = await svc.listAll(
      { status: 'ACTIVE', page: 1, pageSize: 20 },
      'u',
      ['SUPER_ADMIN'],
    );
    expect(out.pagination).toMatchObject({ totalItems: 1, totalPages: 1 });
    expect(out.data[0]).toMatchObject({
      trustScore: 100,
      trustLevel: 'HIGH',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });

  it('deviceTrust prioritizes fresh complete active devices', () => {
    const now = new Date('2026-10-26T12:00:00.000Z');
    const fresh = {
      status: 'ACTIVE',
      lastSeenAt: new Date('2026-10-26T11:00:00.000Z'),
      deviceName: 'Galaxy',
      appVersion: '1.0.0',
      installationId: 'inst-1',
      platform: 'ANDROID',
    };
    expect(deviceTrust(fresh, now)).toEqual({
      trustScore: 100,
      trustLevel: 'HIGH',
    });
    expect(
      deviceTrust(
        {
          ...fresh,
          status: 'PENDING',
          lastSeenAt: new Date('2026-10-26T11:00:00.000Z'),
        },
        now,
      ),
    ).toEqual({ trustScore: 75, trustLevel: 'MEDIUM' });
    expect(
      deviceTrust(
        {
          status: 'REVOKED',
          lastSeenAt: null,
          deviceName: null,
          appVersion: null,
          installationId: null,
          platform: null,
        },
        now,
      ),
    ).toEqual({ trustScore: 0, trustLevel: 'LOW' });
  });

  it('revoke flips, kills sessions, audits; idempotent when already revoked', async () => {
    const update = vi.fn(
      async (a: { where: { id: string }; data: object }) => ({
        id: a.where.id,
        ...a.data,
      }),
    );
    const revokeSessions = vi.fn(async () => ({ count: 3 }));
    const prisma = makePrisma({
      device: {
        findUnique: vi.fn(async () => active),
        update,
      },
      session: { updateMany: revokeSessions },
    } as never);
    const svc = new DevicesService(prisma, auditStub);
    const out = (await svc.revoke(
      'd1',
      'admin',
      ['SUPER_ADMIN'],
      'stolen',
    )) as { status: string };
    expect(out.status).toBe('REVOKED');
    expect(revokeSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deviceId: 'd1' }),
      }),
    );
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEVICE_REVOKED' }),
    );

    const svc2 = new DevicesService(
      makePrisma({
        device: {
          findUnique: vi.fn(async () => ({ ...active, status: 'REVOKED' })),
        },
      } as never),
      auditStub,
    );
    await expect(
      svc2.revoke('d1', 'admin', ['SUPER_ADMIN']),
    ).resolves.toMatchObject({ status: 'REVOKED' });
  });

  it('markLost: owner and admin pass, stranger 404', async () => {
    const prisma = makePrisma({
      device: {
        findUnique: vi.fn(async () => ({
          ...active,
          employee: { userId: 'u1', department: { hospitalId: 'h1' } },
        })),
        update: vi.fn(async (a: { where: { id: string }; data: object }) => ({
          id: a.where.id,
          ...a.data,
        })),
      },
      session: { updateMany: vi.fn(async () => ({})) },
    } as never);
    const svc = new DevicesService(prisma, auditStub);
    await expect(svc.markLost('d1', 'u1', ['EMPLOYEE'])).resolves.toMatchObject(
      { status: 'LOST' },
    );
    await expect(svc.markLost('d1', 'u9', ['ADMIN'])).resolves.toMatchObject({
      status: 'LOST',
    });
    await expect(svc.markLost('d1', 'u9', ['EMPLOYEE'])).rejects.toThrow(
      'Device not found',
    );
  });
});

describe('DevicesService.activate (STEP 18 — aktivasi langsung)', () => {
  const pending = { id: 'd2', employeeId: 'e1', status: 'PENDING' };

  function activatePrisma(over: Record<string, Record<string, unknown>> = {}) {
    const prisma = {
      employee: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
          'userId' in a.where
            ? { id: 'e-adm', department: { hospitalId: 'h1' } }
            : { id: 'e1' },
        ),
        ...over.employee,
      },
      device: {
        findUnique: vi.fn(async () => null),
        count: vi.fn(async () => 0),
        update: vi.fn(async (a: { where: { id: string }; data: object }) => ({
          id: a.where.id,
          ...a.data,
        })),
        ...over.device,
      },
      ...over,
    } as unknown as PrismaService;
    return prisma;
  }

  it('PENDING → ACTIVE tanpa mencabut perangkat aktif lain', async () => {
    (auditStub as unknown as { log: ReturnType<typeof vi.fn> }).log.mockClear();
    const prisma = activatePrisma({
      device: {
        findUnique: vi.fn(async () => ({
          ...pending,
          employee: { department: { hospitalId: 'h1' } },
        })),
        count: vi.fn(async () => 0),
        update: vi.fn(async (a: { where: { id: string }; data: object }) => ({
          id: a.where.id,
          ...a.data,
        })),
      },
    });
    const svc = new DevicesService(prisma, auditStub);
    const out = (await svc.activate(
      'd2',
      'admin',
      ['SUPER_ADMIN'],
      'kasir RS',
    )) as { status: string };
    expect(out.status).toBe('ACTIVE');

    const update = (
      prisma as unknown as { device: { update: ReturnType<typeof vi.fn> } }
    ).device.update;

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'd2' },
      data: { status: 'ACTIVE' },
    });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEVICE_ACTIVATED', targetId: 'd2' }),
    );
    expect(auditStub.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEVICE_REVOKED' }),
    );
  });

  it('non-PENDING device -> 409; foreign-facility ADMIN -> 404', async () => {
    const svc = new DevicesService(
      activatePrisma({
        device: {
          findUnique: vi.fn(async () => ({
            ...pending,
            status: 'REVOKED',
            employee: { department: { hospitalId: 'h1' } },
          })),
        },
      }),
      auditStub,
    );
    await expect(svc.activate('d2', 'admin', ['SUPER_ADMIN'])).rejects.toThrow(
      'Only PENDING devices can be activated',
    );

    const foreign = activatePrisma({
      device: {
        findUnique: vi.fn(async () => ({
          ...pending,
          employee: { department: { hospitalId: 'h-other' } },
        })),
      },
    });
    const svc2 = new DevicesService(foreign, auditStub);
    await expect(svc2.activate('d2', 'admin', ['ADMIN'])).rejects.toThrow(
      'Device not found',
    );
  });
});

describe('DevicesService.getOne/heartbeat/validate', () => {
  const dev = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    employeeId: 'e1',
    status: 'ACTIVE',
    employee: {
      id: 'e1',
      userId: 'u1',
      name: 'Siti',
      employeeNo: 'EMP-001',
      department: { hospitalId: 'h1' },
    },
    ...over,
  });

  it('owner and admin can read; stranger gets 404', async () => {
    const prisma = makePrisma({
      device: { findUnique: vi.fn(async () => dev()) },
    });
    const svc = new DevicesService(prisma, auditStub);
    await expect(svc.getOne('d1', 'u1', ['EMPLOYEE'])).resolves.toMatchObject({
      id: 'd1',
    });
    await expect(svc.getOne('d1', 'u9', ['ADMIN'])).resolves.toMatchObject({
      id: 'd1',
    });
    await expect(svc.getOne('d1', 'u9', ['EMPLOYEE'])).rejects.toThrow(
      'Device not found',
    );
  });

  it('heartbeat requires ownership', async () => {
    const update = vi.fn(async (a: { where: { id: string } }) => ({
      id: a.where.id,
    }));
    const prisma = makePrisma({
      employee: {
        findUnique: vi.fn(async (a: { where: { userId: string } }) =>
          a.where.userId === 'u1' ? { id: 'e1', userId: 'u1' } : null,
        ),
      },
      device: { findUnique: vi.fn(async () => dev()), update },
    });
    const svc = new DevicesService(prisma, auditStub);
    await expect(svc.heartbeat('d1', 'u1')).resolves.toMatchObject({
      id: 'd1',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      }),
    );
    await expect(svc.heartbeat('d1', 'intruder')).rejects.toThrow(
      'Device not found',
    );
  });

  it('validateDeviceFor matrix (PRD test: authorized/unauthorized/revoked)', async () => {
    const byId: Record<string, unknown> = {
      good: dev(),
      revoked: dev({ id: 'revoked', status: 'REVOKED' }),
      other: dev({ id: 'other', employeeId: 'e9' }),
    };
    const prisma = makePrisma({
      device: {
        findUnique: vi.fn(
          async (a: { where: { id: string } }) => byId[a.where.id] ?? null,
        ),
      },
    });
    const svc = new DevicesService(prisma, auditStub);
    expect(await svc.validateDeviceFor('e1', 'good')).toEqual({
      ok: true,
      device: { id: 'd1', status: 'ACTIVE' },
    });
    expect(await svc.validateDeviceFor('e1', 'nope')).toEqual({
      ok: false,
      reason: 'UNKNOWN_DEVICE',
    });
    expect(await svc.validateDeviceFor('e1', 'other')).toEqual({
      ok: false,
      reason: 'WRONG_OWNER',
    });
    expect(await svc.validateDeviceFor('e1', 'revoked')).toEqual({
      ok: false,
      reason: 'NOT_ACTIVE',
    });
  });
});

describe('DevicesService facility scoping (ADMIN)', () => {
  const foreign = {
    id: 'd9',
    employeeId: 'e9',
    status: 'ACTIVE',
    employee: {
      id: 'e9',
      userId: 'u9',
      name: 'Tetangga',
      employeeNo: 'EMP-009',
      department: { hospitalId: 'h2' },
    },
  };

  it('foreign getOne / revoke / markLost read as 404', async () => {
    const prisma = makePrisma({
      device: { findUnique: vi.fn(async () => foreign) },
    });
    const svc = new DevicesService(prisma, auditStub);
    await expect(svc.getOne('d9', 'u-adm', ['ADMIN'])).rejects.toThrow(
      'Device not found',
    );
    await expect(svc.revoke('d9', 'u-adm', ['ADMIN'])).rejects.toThrow(
      'Device not found',
    );
    await expect(svc.markLost('d9', 'u-adm', ['ADMIN'])).rejects.toThrow(
      'Device not found',
    );
  });

  it('foreign listAll returns an empty page', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma({
      device: { findMany, count: vi.fn(async () => 0) },
    });
    const svc = new DevicesService(prisma, auditStub);
    const out = await svc.listAll({}, 'u-adm', ['ADMIN']);
    expect(out.pagination.totalItems).toBe(0);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { employee: { department: { hospitalId: 'h1' } } },
          ]),
        }),
      }),
    );
  });
});
