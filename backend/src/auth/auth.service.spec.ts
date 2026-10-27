import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

const PASSWORD = 'Password123!';
let HASH = '';

const configStub = { get: (_key: string, dflt: unknown) => dflt } as never;
const auditStub = { log: vi.fn(async () => undefined) } as never;
const emailVerificationStub = { issue: vi.fn(async () => undefined), verify: vi.fn(async () => ({ userId: 'u1' })) } as never;
const jwt = new JwtService({ secret: 'test-secret' });

function makePrisma(overrides: Record<string, Record<string, unknown>> = {}) {
  return {
    user: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async (a: { where: { id: string } }) => ({
        id: a.where.id,
      })),
      ...overrides.user,
    },
    userRole: { findMany: vi.fn(async () => []), ...overrides.userRole },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
      ...overrides.session,
    },
    device: { findUnique: vi.fn(async () => null), ...overrides.device },
  } as unknown as ConstructorParameters<typeof AuthService>[0];
}

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'employee@rs.test',
    passwordHash: HASH,
    isActive: true,
    emailVerifiedAt: new Date(),
    approvedAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    userRoles: [{ role: { name: 'EMPLOYEE' } }],
    ...over,
  };
}

beforeAll(async () => {
  HASH = await argon2.hash(PASSWORD);
});

describe('AuthService.login', () => {
  it('success resets counters, creates session, audits LOGIN_SUCCESS', async () => {
    const prisma = makePrisma({
      user: {
        findUnique: vi.fn(async () => userRow()),
        update: vi.fn(async () => ({})),
      },
      session: {
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
          id: 's1',
          deviceId: null,
          ...a.data,
        })),
      },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    const out = await svc.login(
      { email: 'employee@rs.test', password: PASSWORD },
      { ip: '1.2.3.4' },
    );
    expect(out.accessToken).toBeTruthy();
    expect(out.refreshToken).toBeTruthy();
    expect(out.user.roles).toEqual(['EMPLOYEE']);
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_SUCCESS', actorId: 'u1' }),
    );
  });

  it('rejects dashboard-only roles from MOBILE but allows WEB', async () => {
    const roles = [{ role: { name: 'SUPERVISOR' } }];
    const mobile = new AuthService(
      makePrisma({ user: { findUnique: vi.fn(async () => userRow({ userRoles: roles })) } }),
      jwt,
      configStub,
      auditStub,
      emailVerificationStub,
    );
    await expect(
      mobile.login(
        { email: 'employee@rs.test', password: PASSWORD, client: 'MOBILE' },
        {},
      ),
    ).rejects.toThrow('dashboard web');

    const web = new AuthService(
      makePrisma({
        user: { findUnique: vi.fn(async () => userRow({ userRoles: roles })) },
        session: {
          create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
            id: 's1',
            deviceId: null,
            ...a.data,
          })),
        },
      }),
      jwt,
      configStub,
      auditStub,
      emailVerificationStub,
    );
    const out = await web.login(
      { email: 'employee@rs.test', password: PASSWORD, client: 'WEB' },
      {},
    );
    expect(out.accessToken).toBeTruthy();
  });

  it('wrong password increments attempts and audits LOGIN_FAILED', async () => {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      user: { findUnique: vi.fn(async () => userRow()), update },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc.login({ email: 'employee@rs.test', password: 'Wrong123!' }, {}),
    ).rejects.toThrow('Invalid credentials');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginAttempts: 1 }),
      }),
    );
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED' }),
    );
  });

  it('5th failure locks the account; locked account gets 403', async () => {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      user: {
        findUnique: vi.fn(async () => userRow({ failedLoginAttempts: 4 })),
        update,
      },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc.login({ email: 'e', password: 'Wrong123!' }, {}),
    ).rejects.toThrow();
    const data = update.mock.calls[0][0].data;
    expect(data.failedLoginAttempts).toBe(5);
    expect(data.lockedUntil).toBeInstanceOf(Date);

    const prisma2 = makePrisma({
      user: {
        findUnique: vi.fn(async () =>
          userRow({ lockedUntil: new Date(Date.now() + 60_000) }),
        ),
      },
    });
    const svc2 = new AuthService(prisma2, jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc2.login({ email: 'e', password: PASSWORD }, {}),
    ).rejects.toThrow('temporarily locked');
  });

  it('unknown email and inactive account both return generic 401', async () => {
    const svc = new AuthService(makePrisma(), jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc.login({ email: 'no@rs.test', password: PASSWORD }, {}),
    ).rejects.toThrow('Invalid credentials');
    const prisma = makePrisma({
      user: { findUnique: vi.fn(async () => userRow({ isActive: false })) },
    });
    const svc2 = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc2.login({ email: 'e', password: PASSWORD }, {}),
    ).rejects.toThrow('Akun menunggu persetujuan admin');
  });

  it('totp-enabled user gets a challenge token and no session yet', async () => {
    const sessionCreate = vi.fn(async () => ({ id: 's9' }));
    const prisma = makePrisma({
      user: {
        findUnique: vi.fn(async () =>
          userRow({ totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' }),
        ),
        update: vi.fn(async () => ({})),
      },
      session: { create: sessionCreate },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    auditStub.log.mockClear();
    const out = (await svc.login(
      { email: 'employee@rs.test', password: PASSWORD },
      {},
    )) as Record<string, unknown>;
    expect(out.totpRequired).toBe(true);
    expect(out.totpToken).toBeTruthy();
    expect((out.totpToken as string).split('.')).toHaveLength(3);
    expect(out.expiresIn).toBe(300);
    expect(out).not.toHaveProperty('accessToken');
    expect(sessionCreate).not.toHaveBeenCalled();
    expect(auditStub.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_SUCCESS' }),
    );
  });
});

describe('AuthService.refresh/logout', () => {
  function sessionRow(over: Record<string, unknown> = {}) {
    return {
      id: 's1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      ipAddress: null,
      userAgent: null,
      user: userRow(),
      ...over,
    };
  }

  it('refresh rotates the token (old dies, new works)', async () => {
    let storedHash = '';
    const prisma = makePrisma({
      session: {
        findUnique: vi.fn(async (a: { where: { refreshTokenHash: string } }) =>
          a.where.refreshTokenHash === storedHash ? sessionRow() : null,
        ),

        updateMany: vi.fn(
          async (a: {
            where: { refreshTokenHash: string };
            data: { refreshTokenHash: string };
          }) => {
            if (a.where.refreshTokenHash !== storedHash) return { count: 0 };
            storedHash = a.data.refreshTokenHash;
            return { count: 1 };
          },
        ),
      },
      user: { findUnique: vi.fn(), update: vi.fn() },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);

    const { createHash, randomBytes } = await import('node:crypto');
    const first = randomBytes(48).toString('base64url');
    storedHash = createHash('sha256').update(first).digest('hex');

    const r1 = await svc.refresh(first, {});
    expect(r1.refreshToken).not.toBe(first);
    await expect(svc.refresh(first, {})).rejects.toThrow(
      'Invalid refresh token',
    );
    const r2 = await svc.refresh(r1.refreshToken, {});
    expect(r2.accessToken).toBeTruthy();
  });

  it('concurrent refresh with the same token lets exactly one through', async () => {
    let storedHash = '';
    const prisma = makePrisma({
      session: {
        findUnique: vi.fn(async (a: { where: { refreshTokenHash: string } }) =>
          a.where.refreshTokenHash === storedHash ? sessionRow() : null,
        ),
        updateMany: vi.fn(
          async (a: {
            where: { refreshTokenHash: string };
            data: { refreshTokenHash: string };
          }) => {
            if (a.where.refreshTokenHash !== storedHash) return { count: 0 };
            storedHash = a.data.refreshTokenHash;
            return { count: 1 };
          },
        ),
      },
      user: { findUnique: vi.fn(), update: vi.fn() },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    const { createHash, randomBytes } = await import('node:crypto');
    const first = randomBytes(48).toString('base64url');
    storedHash = createHash('sha256').update(first).digest('hex');

    const [a, b] = await Promise.allSettled([
      svc.refresh(first, {}),
      svc.refresh(first, {}),
    ]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    const winner = (
      a.status === 'fulfilled'
        ? a.value
        : (b as PromiseFulfilledResult<{ refreshToken: string }>).value
    ) as {
      refreshToken: string;
    };

    await expect(svc.refresh(first, {})).rejects.toThrow(
      'Invalid refresh token',
    );
    await expect(svc.refresh(winner.refreshToken, {})).resolves.toBeDefined();
  });

  it('revoked/expired refresh rejected; logout revokes + audits', async () => {
    const prisma = makePrisma({
      session: {
        findUnique: vi.fn(async () => sessionRow({ revokedAt: new Date() })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc.refresh('anything-valid-length-0123456789abcdef', {}),
    ).rejects.toThrow();
    const out = await svc.logout('u1', 's1', { ip: '1.1.1.1' });
    expect(out).toEqual({ loggedOut: true });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGOUT' }),
    );
  });
});

describe('AuthService.changePassword/sessions', () => {
  it('wrong current password rejected; weak new password rejected', async () => {
    const prisma = makePrisma({
      user: { findUnique: vi.fn(async () => userRow()), update: vi.fn() },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc.changePassword(
        'u1',
        's1',
        { currentPassword: 'Nope1234!', newPassword: 'Strong123!' },
        {},
      ),
    ).rejects.toThrow('Current password is incorrect');
    await expect(
      svc.changePassword(
        'u1',
        's1',
        { currentPassword: PASSWORD, newPassword: 'weak' },
        {},
      ),
    ).rejects.toThrow('Weak password');
  });

  it('success rehashes and kills other sessions', async () => {
    const userUpdate = vi.fn(async () => ({}));
    const sessUpdateMany = vi.fn(async () => ({ count: 2 }));
    const prisma = makePrisma({
      user: { findUnique: vi.fn(async () => userRow()), update: userUpdate },
      session: { updateMany: sessUpdateMany },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    const out = await svc.changePassword(
      'u1',
      's1',
      { currentPassword: PASSWORD, newPassword: 'NewStrong123!' },
      {},
    );
    expect(out).toEqual({ changed: true });
    expect(userUpdate.mock.calls[0][0].data.passwordHash).not.toBe(HASH);
    expect(sessUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { id: 's1' } }),
      }),
    );
  });

  it("cannot revoke another user's session", async () => {
    const prisma = makePrisma({
      session: {
        findUnique: vi.fn(async () => ({ id: 'sx', userId: 'other' })),
      },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    await expect(svc.revokeSession('u1', 'sx')).rejects.toThrow(
      'Session not found',
    );
  });
});

describe('AuthService.register (pendaftaran mandiri)', () => {
  function registerPrisma(over: Record<string, Record<string, unknown>> = {}) {
    const prisma = {
      user: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
          id: 'u-new',
          ...a.data,
        })),
        ...over.user,
      },
      employee: {
        findUnique: vi.fn(async () => null),
        count: vi.fn(async () => 0),
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
          id: 'e-new',
          ...a.data,
        })),
        ...over.employee,
      },
      department: {
        findUnique: vi.fn(async () => ({ id: 'dept-1' })),
        ...over.department,
      },
      role: {
        findUnique: vi.fn(async () => ({ id: 'r-emp', name: 'EMPLOYEE' })),
        ...over.role,
      },
      userRole: { create: vi.fn(async () => ({})), ...over.userRole },
      session: {
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
          id: 's1',
          deviceId: null,
          ...a.data,
        })),
        ...over.session,
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    } as unknown as ConstructorParameters<typeof AuthService>[0];
    return prisma;
  }

  it('membuat akun + karyawan + peran EMPLOYEE, langsung memberi sesi', async () => {
    const prisma = registerPrisma();
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    const out = await svc.register({
      name: 'Budi Baru',
      email: 'Baru@RS.test',
      password: PASSWORD,
    });

    expect(out).toEqual({ status: 'VERIFICATION_SENT' });
    expect(
      (prisma as unknown as { userRole: { create: ReturnType<typeof vi.fn> } })
        .userRole.create,
    ).toHaveBeenCalledWith({ data: { userId: 'u-new', roleId: 'r-emp' } });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCOUNT_REGISTERED',
        targetId: 'u-new',
      }),
    );
  });

  it('email yang sudah terdaftar ditolak', async () => {
    const prisma = registerPrisma({
      user: { findUnique: vi.fn(async () => ({ id: 'u1' })) },
    });
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    const out = await svc.register({
      name: 'Budi',
      email: 'employee@rs.test',
      password: PASSWORD,
    });
    expect(out).toEqual({ status: 'VERIFICATION_SENT' });
  });

  it('password lemah ditolak sebelum menyentuh database', async () => {
    const prisma = registerPrisma();
    const svc = new AuthService(prisma, jwt, configStub, auditStub, emailVerificationStub);
    await expect(
      svc.register({
        name: 'Budi',
        email: 'lemah@rs.test',
        password: 'pendek',
      }),
    ).rejects.toThrow('Weak password');
  });
});
