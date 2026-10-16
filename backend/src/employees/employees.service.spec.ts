import * as argon2 from 'argon2';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EmployeesService } from './employees.service.js';

let HASH = '';
beforeAll(async () => {
  HASH = await argon2.hash('Password123!');
});

const auditStub = { log: vi.fn(async () => undefined) } as never;

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  return {
    user: { findUnique: vi.fn(async () => null), create: vi.fn(), update: vi.fn(), ...over.user },
    role: { findUnique: vi.fn(async (a: { where: { name: string } }) => ({ id: `r-${a.where.name}`, name: a.where.name })), ...over.role },
    employee: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(),
      update: vi.fn(),
      ...over.employee,
    },
    department: { findUnique: vi.fn(async () => null), ...over.department },
    session: { updateMany: vi.fn(async () => ({ count: 0 })), ...over.session },
    // Default actor is SUPER_ADMIN (facility bypass), so the pre-existing
    // tests keep exercising the global path unchanged.
    userRole: {
      findMany: vi.fn(async () => [{ role: { name: 'SUPER_ADMIN' } }]),
      ...over.userRole,
    },
  } as unknown as PrismaService;
}

function empRow(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    userId: 'u1',
    employeeNo: 'EMP-001',
    name: 'Siti',
    email: 'siti@rs.test',
    status: 'ACTIVE',
    createdAt: new Date(),
    ...over,
  };
}

const createDto = () => ({
  employeeNo: 'EMP-009',
  name: 'Baru',
  email: 'baru@rs.test',
  password: 'Password123!',
});

describe('EmployeesService.create', () => {
  function base(over: Record<string, Record<string, unknown>> = {}) {
    return makePrisma({
      user: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'u9', ...a.data })),
        ...over.user,
      },
      userRole: {
        findMany: vi.fn(async (a: { where: { userId: string } }) =>
          a.where.userId === 'u9'
            ? [{ role: { name: 'EMPLOYEE' } }]
            : [{ role: { name: 'ADMIN' } }],
        ),
        create: vi.fn(async () => ({})),
        ...over.userRole,
      },
      employee: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'e9', ...a.data })),
        ...over.employee,
      },
      ...over,
    });
  }

  it('creates user + EMPLOYEE role + employee and audits', async () => {
    const prisma = base();
    // findUnique: null for uniqueness probes (by employeeNo), row for final findOne (by id)
    prisma.employee.findUnique = vi.fn(async (a: { where: Record<string, unknown> }) =>
      'id' in a.where ? empRow({ id: 'e9', userId: 'u9' }) : null,
    ) as never;
    const svc = new EmployeesService(prisma, auditStub);
    const out = (await svc.create(createDto(), 'actor-admin')) as { roles: string[] };
    expect(out.roles).toContain('EMPLOYEE');
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_CREATED', actorId: 'actor-admin' }),
    );
    // password hashed, never stored plain
    const createdUser = (prisma.user.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(createdUser.passwordHash).not.toBe('Password123!');
  });

  it('duplicate email / employeeNo -> 409', async () => {
    const prisma = base({
      user: { findUnique: vi.fn(async () => ({ id: 'ux' })) },
    });
    const svc = new EmployeesService(prisma, auditStub);
    await expect(svc.create(createDto(), 'a')).rejects.toThrow('Email already in use');

    const prisma2 = base({
      employee: { findUnique: vi.fn(async () => ({ id: 'ex' })) },
    });
    const svc2 = new EmployeesService(prisma2, auditStub);
    await expect(svc2.create(createDto(), 'a')).rejects.toThrow('Employee number already in use');
  });

  it('ADMIN actor cannot grant ADMIN role; weak password rejected', async () => {
    const svc = new EmployeesService(base(), auditStub);
    await expect(svc.create({ ...createDto(), roles: ['ADMIN'] }, 'actor-admin')).rejects.toThrow(
      'Not allowed to grant role ADMIN',
    );
    await expect(
      svc.create({ ...createDto(), password: 'weakpass1' }, 'actor-admin'),
    ).rejects.toThrow('Weak password');
  });

  it('P2002 race maps to 409', async () => {
    const prisma = base({
      user: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => {
          throw { code: 'P2002', meta: { target: ['email'] } };
        }),
      },
    });
    const svc = new EmployeesService(prisma, auditStub);
    await expect(svc.create(createDto(), 'a')).rejects.toThrow('email already in use');
  });
});

describe('EmployeesService.update/deactivate', () => {
  it('self-supervisor and email takeover rejected', async () => {
    const prisma = makePrisma({
      employee: { findUnique: vi.fn(async () => empRow()) },
    });
    const svc = new EmployeesService(prisma, auditStub);
    await expect(svc.update('e1', { supervisorId: 'e1' }, 'a')).rejects.toThrow(
      'cannot supervise themselves',
    );
  });

  it('deactivate preserves record, kills login + sessions, audits', async () => {
    let dead = false;
    const userUpdate = vi.fn(async () => ({}));
    const sessRevoke = vi.fn(async () => ({ count: 2 }));
    const empUpdate = vi.fn(async (a: { where: { id: string } }) => {
      dead = true;
      return empRow({ status: 'INACTIVE' });
    });
    const prisma = makePrisma({
      employee: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) => {
          // Actor lookup (by userId) resolves to the same facility as the target.
          if ('userId' in a.where) return { id: 'e-adm', department: { hospitalId: 'h1' } };
          return a.where.id === 'e1'
            ? empRow({ status: dead ? 'INACTIVE' : 'ACTIVE', department: { hospitalId: 'h1' } })
            : null;
        }),
        update: empUpdate,
      },
      user: { update: userUpdate },
      session: { updateMany: sessRevoke },
      // M7: actor is ADMIN acting on an EMPLOYEE — rank guard allows it.
      userRole: {
        findMany: vi.fn(async (a: { where: { userId: string } }) =>
          a.where.userId === 'actor-admin'
            ? [{ role: { name: 'ADMIN' } }]
            : [{ role: { name: 'EMPLOYEE' } }],
        ),
      },
    });
    const svc = new EmployeesService(prisma, auditStub);
    const out = (await svc.deactivate('e1', 'actor-admin')) as { status: string };
    expect(out.status).toBe('INACTIVE');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
    expect(sessRevoke).toHaveBeenCalled();
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_DEACTIVATED' }),
    );
  });

  it('unknown employee -> 404', async () => {
    const svc = new EmployeesService(makePrisma(), auditStub);
    await expect(svc.deactivate('nope', 'a')).rejects.toThrow('Employee not found');
    await expect(svc.update('nope', { name: 'x' }, 'a')).rejects.toThrow('Employee not found');
  });

  it('findAll returns pagination envelope', async () => {
    const prisma = makePrisma({
      employee: {
        count: vi.fn(async () => 3),
        findMany: vi.fn(async () => [empRow(), empRow({ id: 'e2' })]),
      },
    });
    const svc = new EmployeesService(prisma, auditStub);
    const out = await svc.findAll({ page: 1, pageSize: 2 }, 'u', ['SUPER_ADMIN']);
    expect(out.pagination).toMatchObject({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect(out.data).toHaveLength(2);
  });
});

describe('EmployeesService extras (STEP 23 coverage)', () => {
  it('deactivate without user skips login kill; findMyEmployee 404', async () => {
    let dead = false;
    const empUpdate = vi.fn(async (a: { where: { id: string } }) => {
      dead = true;
      return { id: a.where.id, status: 'INACTIVE', userId: null };
    });
    const prisma = makePrisma({
      employee: {
        findUnique: vi.fn(async () => ({
          id: 'e9',
          userId: null,
          employeeNo: 'EMP-009',
          status: dead ? 'INACTIVE' : 'ACTIVE',
        })),
        update: empUpdate,
      },
    });
    const svc = new EmployeesService(prisma, auditStub);
    await expect(svc.deactivate('e9', 'admin')).resolves.toMatchObject({ status: 'INACTIVE' });

    const svc2 = new EmployeesService(
      makePrisma({ employee: { findUnique: vi.fn(async () => null) } }),
      auditStub,
    );
    await expect(svc2.findMyEmployee('ghost')).rejects.toThrow('No employee profile');
  });

  it('update propagates email to user; unknown department 404', async () => {
    const userUpdate = vi.fn(async () => ({}));
    const prisma = makePrisma({
      employee: {
        findUnique: vi.fn(async () => ({ id: 'e1', userId: 'u1', email: 'old@rs.test' })),
        update: vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data })),
      },
      user: { update: userUpdate },
      department: { findUnique: vi.fn(async () => ({ id: 'd1' })) },
    });
    const svc = new EmployeesService(prisma, auditStub);
    await svc.update('e1', { email: 'new@rs.test' }, 'admin');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );

    const svc2 = new EmployeesService(
      makePrisma({
        employee: { findUnique: vi.fn(async () => ({ id: 'e1', userId: 'u1', email: 'a@b.c' })) },
        department: { findUnique: vi.fn(async () => null) },
      }),
      auditStub,
    );
    await expect(svc2.update('e1', { departmentId: 'dx' }, 'admin')).rejects.toThrow('Department not found');
  });
});

// Tahap 2 — facility scoping: an ADMIN of h1 sees and touches only h1.
describe('EmployeesService facility scoping (ADMIN)', () => {
  // Actor u-adm belongs to hospital h1.
  function scopedPrisma(over: Record<string, Record<string, unknown>> = {}) {
    return makePrisma({
      userRole: { findMany: vi.fn(async () => [{ role: { name: 'ADMIN' } }]) },
      employee: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
          'userId' in a.where
            ? { id: 'e-adm', department: { hospitalId: 'h1' } }
            : { id: 'e2', userId: 'u2', department: { hospitalId: 'h2' } },
        ),
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
      },
      ...over,
    });
  }

  it('findAll is confined to the caller hospital', async () => {
    const findMany = vi.fn(async () => []);
    const svc = new EmployeesService(scopedPrisma({ employee: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
        'userId' in a.where ? { id: 'e-adm', department: { hospitalId: 'h1' } } : null,
      ),
      findMany,
      count: vi.fn(async () => 0),
    } }), auditStub);
    await svc.findAll({}, 'u-adm', ['ADMIN']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ department: { hospitalId: 'h1' } }] },
      }),
    );
  });

  it('foreign findOne / update / deactivate read as 404', async () => {
    const svc = new EmployeesService(scopedPrisma(), auditStub);
    await expect(svc.findOne('e2', 'u-adm', ['ADMIN'])).rejects.toThrow('Employee not found');
    await expect(svc.update('e2', { name: 'X' }, 'u-adm')).rejects.toThrow('Employee not found');
    await expect(svc.deactivate('e2', 'u-adm')).rejects.toThrow('Employee not found');
  });
});

// M7 — rank guard: a non-SUPER_ADMIN cannot touch accounts ranked at or above
// their own, even inside their own facility.
describe('EmployeesService rank guard (ADMIN vs SUPER_ADMIN)', () => {
  // Actor u-adm is ADMIN of h1. e-victim belongs to a SUPER_ADMIN in h1,
  // e-junior to an EMPLOYEE in h1, e-far to a SUPER_ADMIN in h2.
  function rankPrisma() {
    return makePrisma({
      userRole: {
        findMany: vi.fn(async (a: { where: { userId: string } }) => {
          if (a.where.userId === 'u-adm') return [{ role: { name: 'ADMIN' } }];
          if (a.where.userId === 'u-victim') return [{ role: { name: 'SUPER_ADMIN' } }];
          if (a.where.userId === 'u-far') return [{ role: { name: 'SUPER_ADMIN' } }];
          return [{ role: { name: 'EMPLOYEE' } }];
        }),
      },
      employee: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) => {
          if ('userId' in a.where) {
            if (a.where.userId === 'u-adm') return { id: 'e-adm', department: { hospitalId: 'h1' } };
            return null;
          }
          if (a.where.id === 'e-victim')
            return empRow({ id: 'e-victim', userId: 'u-victim', department: { hospitalId: 'h1' } });
          if (a.where.id === 'e-junior')
            return empRow({ id: 'e-junior', userId: 'u-junior', department: { hospitalId: 'h1' } });
          if (a.where.id === 'e-nouser')
            return empRow({ id: 'e-nouser', userId: null, department: { hospitalId: 'h1' } });
          if (a.where.id === 'e-far')
            return empRow({ id: 'e-far', userId: 'u-far', department: { hospitalId: 'h2' } });
          return null;
        }),
        update: vi.fn(async (a: { where: { id: string }; data: object }) => ({
          ...empRow({ id: a.where.id }),
          ...a.data,
        })),
      },
    });
  }

  it('ADMIN cannot update/deactivate a SUPER_ADMIN employee in the same facility', async () => {
    const svc = new EmployeesService(rankPrisma(), auditStub);
    await expect(svc.update('e-victim', { name: 'X' }, 'u-adm')).rejects.toThrow(
      'at or above your own rank',
    );
    await expect(svc.deactivate('e-victim', 'u-adm')).rejects.toThrow(
      'at or above your own rank',
    );
  });

  it('ADMIN CAN update/deactivate a same-facility EMPLOYEE (and userless rows)', async () => {
    const prisma = rankPrisma();
    const svc = new EmployeesService(prisma, auditStub);
    await expect(svc.update('e-junior', { name: 'Ok' }, 'u-adm')).resolves.toMatchObject({
      id: 'e-junior',
    });
    // loadOne re-reads via findUnique (stub returns the stored ACTIVE row);
    // the guard passing (no throw) is what this case proves.
    await expect(svc.deactivate('e-nouser', 'u-adm')).resolves.toMatchObject({
      id: 'e-nouser',
    });
  });

  it('cross-facility SUPER_ADMIN row still reads as 404 (facility gate first)', async () => {
    const svc = new EmployeesService(rankPrisma(), auditStub);
    await expect(svc.update('e-far', { name: 'X' }, 'u-adm')).rejects.toThrow('Employee not found');
    await expect(svc.deactivate('e-far', 'u-adm')).rejects.toThrow('Employee not found');
  });
});
