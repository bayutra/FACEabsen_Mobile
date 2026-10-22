import { describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

vi.mock('argon2', () => ({
  hash: vi.fn(async (password: string) => `hashed::${password}`),
  verify: vi.fn(
    async (hash: string, password: string) => hash === `hashed::${password}`,
  ),
}));

const HASH = 'hashed::Password123!';

const auditStub = { log: vi.fn(async () => undefined) } as never;

function makePrisma(
  rolesByUserId: Record<string, string[]> = {},
  over: Record<string, Record<string, unknown>> = {},
) {
  const base = {
    user: {
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (a: { data: { email: string } }) => ({
        id: 'u-new',
        email: a.data.email,
        isActive: true,
      })),
      update: vi.fn(async (a: { where: { id: string } }) => ({ ...a.where })),
      ...over.user,
    },
    userRole: {
      findMany: vi.fn(async (a: { where: { userId: string } }) =>
        (rolesByUserId[a.where.userId] ?? []).map((name) => ({
          role: { name },
        })),
      ),
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      ...over.userRole,
    },
    role: {
      findUnique: vi.fn(async (a: { where: { name: string } }) => ({
        id: `r-${a.where.name}`,
        name: a.where.name,
      })),
      ...over.role,
    },
    session: { updateMany: vi.fn(async () => ({ count: 0 })), ...over.session },

    employee: { findUnique: vi.fn(async () => null), ...over.employee },
  };
  return {
    ...base,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(base),
    ),
  } as unknown as PrismaService;
}

const svc = (prisma: PrismaService) => new UsersService(prisma, auditStub);

describe('UsersService.createUser', () => {
  it('always adds EMPLOYEE and audits the grant set', async () => {
    const prisma = makePrisma({ 'actor-admin': ['ADMIN'] });
    const out = await svc(prisma).createUser(
      { email: 'it@rs.test', password: 'Password123!' },
      'actor-admin',
    );

    expect(out).toMatchObject({ email: 'it@rs.test', roles: ['EMPLOYEE'] });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_CREATED' }),
      expect.anything(),
    );
  });

  it('refuses to mint an ADMIN or SUPER_ADMIN for a non-SUPER_ADMIN actor', async () => {
    const prisma = makePrisma({ 'actor-admin': ['ADMIN'] });
    await expect(
      svc(prisma).createUser(
        { email: 'x@rs.test', password: 'Password123!', roles: ['ADMIN'] },
        'actor-admin',
      ),
    ).rejects.toThrow('Not allowed to grant role ADMIN');

    await expect(
      svc(prisma).createUser(
        {
          email: 'y@rs.test',
          password: 'Password123!',
          roles: ['SUPER_ADMIN'],
        },
        'actor-admin',
      ),
    ).rejects.toThrow('Not allowed to grant role SUPER_ADMIN');
  });

  it('lets a SUPER_ADMIN mint any role', async () => {
    const prisma = makePrisma({ 'actor-sa': ['SUPER_ADMIN'] });
    const out = await svc(prisma).createUser(
      {
        email: 'boss@rs.test',
        password: 'Password123!',
        roles: ['SUPER_ADMIN'],
      },
      'actor-sa',
    );
    expect(out.roles).toEqual(['EMPLOYEE', 'SUPER_ADMIN']);
  });

  it('rejects a duplicate email and a weak password', async () => {
    const dup = makePrisma(
      { a: ['ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => ({ id: 'u1', email: 'it@rs.test' })),
        },
      },
    );
    await expect(
      svc(dup).createUser(
        { email: 'it@rs.test', password: 'Password123!' },
        'a',
      ),
    ).rejects.toThrow('Email already in use');

    const weak = makePrisma({ a: ['ADMIN'] });
    await expect(
      svc(weak).createUser({ email: 'n@rs.test', password: 'weak' }, 'a'),
    ).rejects.toThrow('Weak password');
  });

  it('maps a P2002 race to a conflict', async () => {
    const prisma = makePrisma(
      { a: ['ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => null),
          create: vi.fn(async () => {
            throw Object.assign(new Error('unique'), {
              code: 'P2002',
              meta: { target: ['email'] },
            });
          }),
        },
      },
    );
    await expect(
      svc(prisma).createUser(
        { email: 'dup@rs.test', password: 'Password123!' },
        'a',
      ),
    ).rejects.toThrow('Email already in use');
  });
});

describe('UsersService.updateUser rank guard', () => {
  it('lets an ADMIN edit an EMPLOYEE account', async () => {
    const prisma = makePrisma(
      { 'actor-admin': ['ADMIN'], 'u-emp': ['EMPLOYEE'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-emp',
            email: 'e@rs.test',
            isActive: true,
          })),
        },
      },
    );

    const out = await svc(prisma).updateUser(
      'u-emp',
      { roles: ['SUPERVISOR'] },
      'actor-admin',
    );
    expect(out.roles).toEqual(['SUPERVISOR']);
  });

  it('blocks an ADMIN from touching a peer ADMIN or the SUPER_ADMIN', async () => {
    const peer = makePrisma(
      { 'actor-admin': ['ADMIN'], 'u-admin': ['ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-admin',
            email: 'a2@rs.test',
            isActive: true,
          })),
        },
      },
    );
    await expect(
      svc(peer).updateUser('u-admin', { isActive: false }, 'actor-admin'),
    ).rejects.toThrow('at or above your own rank');

    const boss = makePrisma(
      { 'actor-admin': ['ADMIN'], 'u-sa': ['SUPER_ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-sa',
            email: 'sa@rs.test',
            isActive: true,
          })),
        },
      },
    );
    await expect(
      svc(boss).updateUser('u-sa', { isActive: false }, 'actor-admin'),
    ).rejects.toThrow('at or above your own rank');
  });

  it('lets a SUPER_ADMIN administer peers', async () => {
    const prisma = makePrisma(
      { 'actor-sa': ['SUPER_ADMIN'], 'u-admin': ['ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-admin',
            email: 'a@rs.test',
            isActive: true,
          })),
        },
      },
    );
    await expect(
      svc(prisma).updateUser('u-admin', { isActive: false }, 'actor-sa'),
    ).resolves.toBeTruthy();
  });

  it('refuses self-deactivation and self role edits', async () => {
    const selfDeactivate = makePrisma(
      { me: ['ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'me',
            email: 'me@rs.test',
            isActive: true,
          })),
        },
      },
    );
    await expect(
      svc(selfDeactivate).updateUser('me', { isActive: false }, 'me'),
    ).rejects.toThrow('cannot deactivate your own account');

    const selfRoles = makePrisma(
      { me: ['ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'me',
            email: 'me@rs.test',
            isActive: true,
          })),
        },
      },
    );
    await expect(
      svc(selfRoles).updateUser('me', { roles: ['SUPERVISOR'] }, 'me'),
    ).rejects.toThrow('cannot change your own roles');
  });

  it('404s on an unknown id', async () => {
    const prisma = makePrisma({ a: ['ADMIN'] });
    await expect(
      svc(prisma).updateUser('nope', { isActive: true }, 'a'),
    ).rejects.toThrow('User not found');
  });

  it('revokes live sessions and clears the lockout when re-enabling', async () => {
    const update = vi.fn(async () => ({}));
    const sessionUpdate = vi.fn(async () => ({ count: 2 }));
    const prisma = makePrisma(
      { 'actor-sa': ['SUPER_ADMIN'], 'u-emp': ['EMPLOYEE'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-emp',
            email: 'e@rs.test',
            isActive: false,
          })),
          update,
        },
        session: { updateMany: sessionUpdate },
      },
    );

    await svc(prisma).updateUser('u-emp', { isActive: true }, 'actor-sa');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: true, failedLoginAttempts: 0, lockedUntil: null },
      }),
    );

    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it('revokes sessions when deactivating', async () => {
    const sessionUpdate = vi.fn(async () => ({ count: 2 }));
    const prisma = makePrisma(
      { 'actor-sa': ['SUPER_ADMIN'], 'u-emp': ['EMPLOYEE'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-emp',
            email: 'e@rs.test',
            isActive: true,
          })),
          update: vi.fn(async () => ({})),
        },
        session: { updateMany: sessionUpdate },
      },
    );

    await svc(prisma).updateUser('u-emp', { isActive: false }, 'actor-sa');
    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u-emp', revokedAt: null } }),
    );
  });
});

describe('UsersService.resetPassword', () => {
  it('rehashes, clears the lockout, revokes sessions and audits', async () => {
    const update = vi.fn(async () => ({}));
    const sessionUpdate = vi.fn(async () => ({ count: 3 }));
    const prisma = makePrisma(
      { 'actor-sa': ['SUPER_ADMIN'], 'u-emp': ['EMPLOYEE'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-emp',
            email: 'e@rs.test',
            isActive: true,
          })),
          update,
        },
        session: { updateMany: sessionUpdate },
      },
    );

    await expect(
      svc(prisma).resetPassword(
        'u-emp',
        { password: 'Password123!' },
        'actor-sa',
      ),
    ).resolves.toEqual({ reset: true });

    const data = (
      update.mock.calls[0]?.[0] as {
        data: { passwordHash: string; lockedUntil: null };
      }
    ).data;

    expect(data.passwordHash).toBe(HASH);
    expect(data.passwordHash).not.toBe('Password123!');
    await expect(
      argon2.verify(data.passwordHash, 'Password123!'),
    ).resolves.toBe(true);
    expect(data.lockedUntil).toBeNull();
    expect(sessionUpdate).toHaveBeenCalled();
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_PASSWORD_RESET' }),
      expect.anything(),
    );
  });

  it('rejects a weak password and enforces the rank guard', async () => {
    const weak = makePrisma(
      { 'actor-sa': ['SUPER_ADMIN'], 'u-emp': ['EMPLOYEE'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-emp',
            email: 'e@rs.test',
            isActive: true,
          })),
        },
      },
    );
    await expect(
      svc(weak).resetPassword('u-emp', { password: 'abc' }, 'actor-sa'),
    ).rejects.toThrow('Weak password');

    const blocked = makePrisma(
      { 'actor-admin': ['ADMIN'], 'u-sa': ['SUPER_ADMIN'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-sa',
            email: 'sa@rs.test',
            isActive: true,
          })),
        },
      },
    );
    await expect(
      svc(blocked).resetPassword(
        'u-sa',
        { password: 'Password123!' },
        'actor-admin',
      ),
    ).rejects.toThrow('at or above your own rank');
  });
});

describe('UsersService.listUsers', () => {
  it('flattens roles and paginates', async () => {
    const prisma = makePrisma(
      {},
      {
        user: {
          count: vi.fn(async () => 1),
          findMany: vi.fn(async () => [
            {
              id: 'u1',
              email: 'e@rs.test',
              isActive: true,
              failedLoginAttempts: 0,
              lockedUntil: null,
              createdAt: new Date(),
              userRoles: [
                { role: { name: 'EMPLOYEE' } },
                { role: { name: 'SUPERVISOR' } },
              ],
              employee: null,
            },
          ]),
        },
      },
    );

    const out = await svc(prisma).listUsers({}, 'u', ['SUPER_ADMIN']);
    expect(out.data[0].roles).toEqual(['EMPLOYEE', 'SUPERVISOR']);
    expect(out.data[0].userRoles).toBeUndefined();
    expect(out.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('builds a role filter and an inactive filter', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma(
      {},
      { user: { count: vi.fn(async () => 0), findMany } },
    );

    await svc(prisma).listUsers(
      { role: 'SUPERVISOR', isActive: false, search: 'bayu' },
      'u',
      ['SUPER_ADMIN'],
    );
    const args = findMany.mock.calls[0]?.[0] as {
      where: { AND: Record<string, unknown>[] };
    };
    expect(args.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isActive: false }),
        expect.objectContaining({ userRoles: expect.anything() }),
        expect.objectContaining({ OR: expect.anything() }),
      ]),
    );
  });
});

describe('UsersService facility scoping (ADMIN)', () => {
  it('foreign employee-linked account reads as 404 on update', async () => {
    const prisma = makePrisma(
      { 'u-adm': ['ADMIN'], 'u-far': ['EMPLOYEE'] },
      {
        user: {
          findUnique: vi.fn(async () => ({
            id: 'u-far',
            email: 'f@rs.test',
            isActive: true,
          })),
        },
        employee: {
          findUnique: vi.fn(async (a: { where: { userId: string } }) => {
            if (a.where.userId === 'u-adm')
              return { department: { hospitalId: 'h1' } };
            if (a.where.userId === 'u-far')
              return { department: { hospitalId: 'h2' } };
            return null;
          }),
        },
      },
    );
    await expect(
      svc(prisma).updateUser('u-far', { isActive: false }, 'u-adm'),
    ).rejects.toThrow('User not found');
  });

  it('employeeless target stays manageable; listUsers keeps employeeless rows', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma(
      { 'u-adm': ['ADMIN'], 'u-desk': ['EMPLOYEE'] },
      {
        user: {
          count: vi.fn(async () => 0),
          findMany,
          findUnique: vi.fn(async () => ({
            id: 'u-desk',
            email: 'd@rs.test',
            isActive: true,
          })),
        },
        employee: {
          findUnique: vi.fn(async (a: { where: { userId: string } }) =>
            a.where.userId === 'u-adm'
              ? { department: { hospitalId: 'h1' } }
              : null,
          ),
        },
      },
    );

    await expect(
      svc(prisma).updateUser('u-desk', { isActive: false }, 'u-adm'),
    ).resolves.toBeDefined();

    const out = await svc(prisma).listUsers({}, 'u-adm', ['ADMIN']);
    expect(out.pagination.totalItems).toBe(0);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { employee: { department: { hospitalId: 'h1' } } },
                { employee: { is: null } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });
});
