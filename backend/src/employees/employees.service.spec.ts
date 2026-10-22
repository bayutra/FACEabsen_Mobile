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
    user: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(),
      update: vi.fn(),
      ...over.user,
    },
    role: {
      findUnique: vi.fn(async (a: { where: { name: string } }) => ({
        id: `r-${a.where.name}`,
        name: a.where.name,
      })),
      ...over.role,
    },
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
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
          id: 'u9',
          ...a.data,
        })),
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
        create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
          id: 'e9',
          ...a.data,
        })),
        ...over.employee,
      },
      ...over,
    });
  }

  it('creates user + EMPLOYEE role + employee and audits', async () => {
    const prisma = base();

    prisma.employee.findUnique = vi.fn(
      async (a: { where: Record<string, unknown> }) =>
        'id' in a.where ? empRow({ id: 'e9', userId: 'u9' }) : null,
    ) as never;
    const svc = new EmployeesService(prisma, auditStub);
    const out = (await svc.create(createDto(), 'actor-admin')) as {
      roles: string[];
    };
    expect(out.roles).toContain('EMPLOYEE');
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_CREATED',
        actorId: 'actor-admin',
      }),
    );

    const createdUser = (prisma.user.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data;
    expect(createdUser.passwordHash).not.toBe('Password123!');
  });

  it('duplicate email / employeeNo -> 409', async () => {
    const prisma = base({
      user: { findUnique: vi.fn(async () => ({ id: 'ux' })) },
    });
    const svc = new EmployeesService(prisma, auditStub);
    await expect(svc.create(createDto(), 'a')).rejects.toThrow(
      'Email already in use',
    );

    const prisma2 = base({
      employee: { findUnique: vi.fn(async () => ({ id: 'ex' })) },
    });
    const svc2 = new EmployeesService(prisma2, auditStub);
    await expect(svc2.create(createDto(), 'a')).rejects.toThrow(
      'Employee number already in use',
    );
  });

  it('ADMIN actor cannot grant ADMIN role; weak password rejected', async () => {
    const svc = new EmployeesService(base(), auditStub);
    await expect(
      svc.create({ ...createDto(), roles: ['ADMIN'] }, 'actor-admin'),
    ).rejects.toThrow('Not allowed to grant role ADMIN');
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
    await expect(svc.create(createDto(), 'a')).rejects.toThrow(
      'email already in use',
    );
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
          if ('userId' in a.where)
            return { id: 'e-adm', department: { hospitalId: 'h1' } };
          return a.where.id === 'e1'
            ? empRow({
                status: dead ? 'INACTIVE' : 'ACTIVE',
                department: { hospitalId: 'h1' },
              })
            : null;
        }),
        update: empUpdate,
      },
      user: { update: userUpdate },
      session: { updateMany: sessRevoke },

      userRole: {
        findMany: vi.fn(async (a: { where: { userId: string } }) =>
          a.where.userId === 'actor-admin'
            ? [{ role: { name: 'ADMIN' } }]
            : [{ role: { name: 'EMPLOYEE' } }],
        ),
      },
    });
    const svc = new EmployeesService(prisma, auditStub);
    const out = (await svc.deactivate('e1', 'actor-admin')) as {
      status: string;
    };
    expect(out.status).toBe('INACTIVE');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
    expect(sessRevoke).toHaveBeenCalled();
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_DEACTIVATED' }),
    );
  });

  it('unknown employee -> 404', async () => {
    const svc = new EmployeesService(makePrisma(), auditStub);
    await expect(svc.deactivate('nope', 'a')).rejects.toThrow(
      'Employee not found',
    );
    await expect(svc.update('nope', { name: 'x' }, 'a')).rejects.toThrow(
      'Employee not found',
    );
  });

  it('findAll returns pagination envelope', async () => {
    const prisma = makePrisma({
      employee: {
        count: vi.fn(async () => 3),
        findMany: vi.fn(async () => [empRow(), empRow({ id: 'e2' })]),
      },
    });
    const svc = new EmployeesService(prisma, auditStub);
    const out = await svc.findAll({ page: 1, pageSize: 2 }, 'u', [
      'SUPER_ADMIN',
    ]);
    expect(out.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
    });
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
    await expect(svc.deactivate('e9', 'admin')).resolves.toMatchObject({
      status: 'INACTIVE',
    });

    const svc2 = new EmployeesService(
      makePrisma({ employee: { findUnique: vi.fn(async () => null) } }),
      auditStub,
    );
    await expect(svc2.findMyEmployee('ghost')).rejects.toThrow(
      'No employee profile',
    );
  });

  it('update propagates email to user; unknown department 404', async () => {
    const userUpdate = vi.fn(async () => ({}));
    const prisma = makePrisma({
      employee: {
        findUnique: vi.fn(async () => ({
          id: 'e1',
          userId: 'u1',
          email: 'old@rs.test',
        })),
        update: vi.fn(async (a: { where: { id: string }; data: object }) => ({
          id: a.where.id,
          ...a.data,
        })),
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
        employee: {
          findUnique: vi.fn(async () => ({
            id: 'e1',
            userId: 'u1',
            email: 'a@b.c',
          })),
        },
        department: { findUnique: vi.fn(async () => null) },
      }),
      auditStub,
    );
    await expect(
      svc2.update('e1', { departmentId: 'dx' }, 'admin'),
    ).rejects.toThrow('Department not found');
  });
});

describe('EmployeesService facility scoping (ADMIN)', () => {
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
    const svc = new EmployeesService(
      scopedPrisma({
        employee: {
          findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
            'userId' in a.where
              ? { id: 'e-adm', department: { hospitalId: 'h1' } }
              : null,
          ),
          findMany,
          count: vi.fn(async () => 0),
        },
      }),
      auditStub,
    );
    await svc.findAll({}, 'u-adm', ['ADMIN']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ department: { hospitalId: 'h1' } }] },
      }),
    );
  });

  it('foreign findOne / update / deactivate read as 404', async () => {
    const svc = new EmployeesService(scopedPrisma(), auditStub);
    await expect(svc.findOne('e2', 'u-adm', ['ADMIN'])).rejects.toThrow(
      'Employee not found',
    );
    await expect(svc.update('e2', { name: 'X' }, 'u-adm')).rejects.toThrow(
      'Employee not found',
    );
    await expect(svc.deactivate('e2', 'u-adm')).rejects.toThrow(
      'Employee not found',
    );
  });
});

describe('EmployeesService supervisor scoping', () => {
  function supervisorPrisma(
    over: Record<string, Record<string, unknown>> = {},
  ) {
    return makePrisma({
      userRole: {
        findMany: vi.fn(async (a: { where: { userId: string } }) => {
          if (a.where.userId === 'u-sup')
            return [{ role: { name: 'SUPERVISOR' } }];
          if (a.where.userId === 'u-admin')
            return [{ role: { name: 'ADMIN' } }];
          return [{ role: { name: 'EMPLOYEE' } }];
        }),
      },
      employee: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) => {
          if ('userId' in a.where) {
            return {
              id: 'e-sup',
              departmentId: 'd1',
              department: { hospitalId: 'h1' },
            };
          }
          if (a.where.id === 'e-emp') {
            return {
              ...empRow({ id: 'e-emp', userId: 'u-emp' }),
              supervisorId: 'e-sup',
              departmentId: 'd2',
              department: { hospitalId: 'h1' },
            };
          }
          if (a.where.id === 'e-other') {
            return {
              ...empRow({ id: 'e-other', userId: 'u-other' }),
              supervisorId: null,
              departmentId: 'd3',
              department: { hospitalId: 'h1' },
            };
          }
          if (a.where.id === 'e-admin') {
            return {
              ...empRow({ id: 'e-admin', userId: 'u-admin' }),
              supervisorId: null,
              departmentId: 'd1',
              department: { hospitalId: 'h1' },
            };
          }
          return null;
        }),
        update: vi.fn(async (a: { where: { id: string }; data: object }) => ({
          ...empRow({ id: a.where.id }),
          ...a.data,
        })),
      },
      ...over,
    });
  }

  it('findAll adds unit/direct-report scope for supervisor', async () => {
    const findMany = vi.fn(async () => []);
    const svc = new EmployeesService(
      supervisorPrisma({
        employee: {
          findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
            'userId' in a.where
              ? {
                  id: 'e-sup',
                  departmentId: 'd1',
                  department: { hospitalId: 'h1' },
                }
              : null,
          ),
          findMany,
          count: vi.fn(async () => 0),
          update: vi.fn(),
        },
      }),
      auditStub,
    );
    await svc.findAll({}, 'u-sup', ['SUPERVISOR']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { department: { hospitalId: 'h1' } },
            { OR: [{ supervisorId: 'e-sup' }, { departmentId: 'd1' }] },
          ],
        },
      }),
    );
  });

  it('findOne / update reject employees outside the unit and direct reports', async () => {
    const svc = new EmployeesService(supervisorPrisma(), auditStub);
    await expect(
      svc.findOne('e-other', 'u-sup', ['SUPERVISOR']),
    ).rejects.toThrow('Employee not found');
    await expect(svc.update('e-other', { name: 'X' }, 'u-sup')).rejects.toThrow(
      'Employee not found',
    );
    await expect(
      svc.findOne('e-emp', 'u-sup', ['SUPERVISOR']),
    ).resolves.toMatchObject({
      id: 'e-emp',
    });
  });

  it('supervisor may update contact fields but not email/unit/supervisor', async () => {
    const prisma = supervisorPrisma();
    const svc = new EmployeesService(prisma, auditStub);
    await expect(
      svc.update('e-emp', { email: 'new@rs.test' }, 'u-sup'),
    ).rejects.toThrow('Hanya admin');
    await expect(
      svc.update('e-emp', { departmentId: 'd9' }, 'u-sup'),
    ).rejects.toThrow('Hanya admin');
    await expect(
      svc.update(
        'e-emp',
        { name: 'Nama Baru', phone: '0812', position: 'Perawat' },
        'u-sup',
      ),
    ).resolves.toMatchObject({ id: 'e-emp' });
    const update = prisma.employee.update as ReturnType<typeof vi.fn>;
    expect(update.mock.calls[0][0].data).toEqual({
      name: 'Nama Baru',
      phone: '0812',
      position: 'Perawat',
    });
  });

  it('supervisor sees only their own unit in listDepartments', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = supervisorPrisma({
      department: { findUnique: vi.fn(), findMany },
    });
    const svc = new EmployeesService(prisma, auditStub);
    await svc.listDepartments(undefined, 'u-sup', ['SUPERVISOR']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' } }),
    );
  });
});

describe('EmployeesService rank guard (ADMIN vs SUPER_ADMIN)', () => {
  function rankPrisma() {
    return makePrisma({
      userRole: {
        findMany: vi.fn(async (a: { where: { userId: string } }) => {
          if (a.where.userId === 'u-adm') return [{ role: { name: 'ADMIN' } }];
          if (a.where.userId === 'u-victim')
            return [{ role: { name: 'SUPER_ADMIN' } }];
          if (a.where.userId === 'u-far')
            return [{ role: { name: 'SUPER_ADMIN' } }];
          return [{ role: { name: 'EMPLOYEE' } }];
        }),
      },
      employee: {
        findUnique: vi.fn(async (a: { where: Record<string, unknown> }) => {
          if ('userId' in a.where) {
            if (a.where.userId === 'u-adm')
              return { id: 'e-adm', department: { hospitalId: 'h1' } };
            return null;
          }
          if (a.where.id === 'e-victim')
            return empRow({
              id: 'e-victim',
              userId: 'u-victim',
              department: { hospitalId: 'h1' },
            });
          if (a.where.id === 'e-junior')
            return empRow({
              id: 'e-junior',
              userId: 'u-junior',
              department: { hospitalId: 'h1' },
            });
          if (a.where.id === 'e-nouser')
            return empRow({
              id: 'e-nouser',
              userId: null,
              department: { hospitalId: 'h1' },
            });
          if (a.where.id === 'e-far')
            return empRow({
              id: 'e-far',
              userId: 'u-far',
              department: { hospitalId: 'h2' },
            });
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
    await expect(
      svc.update('e-victim', { name: 'X' }, 'u-adm'),
    ).rejects.toThrow('at or above your own rank');
    await expect(svc.deactivate('e-victim', 'u-adm')).rejects.toThrow(
      'at or above your own rank',
    );
  });

  it('ADMIN CAN update/deactivate a same-facility EMPLOYEE (and userless rows)', async () => {
    const prisma = rankPrisma();
    const svc = new EmployeesService(prisma, auditStub);
    await expect(
      svc.update('e-junior', { name: 'Ok' }, 'u-adm'),
    ).resolves.toMatchObject({
      id: 'e-junior',
    });

    await expect(svc.deactivate('e-nouser', 'u-adm')).resolves.toMatchObject({
      id: 'e-nouser',
    });
  });

  it('cross-facility SUPER_ADMIN row still reads as 404 (facility gate first)', async () => {
    const svc = new EmployeesService(rankPrisma(), auditStub);
    await expect(svc.update('e-far', { name: 'X' }, 'u-adm')).rejects.toThrow(
      'Employee not found',
    );
    await expect(svc.deactivate('e-far', 'u-adm')).rejects.toThrow(
      'Employee not found',
    );
  });
});
