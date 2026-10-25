import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EmployeesService } from './employees.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const base = {
    hospital: {
      findUnique: vi.fn(async () => ({
        id: 'h1',
        code: 'RS-A',
        name: 'RS Contoh',
      })),
      findMany: vi.fn(async () => []),
      ...over.hospital,
    },
    department: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
        id: 'd1',
        ...a.data,
      })),
      update: vi.fn(
        async (a: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => ({ id: a.where.id, ...a.data }),
      ),
      delete: vi.fn(async () => ({})),
      ...over.department,
    },
    employee: { count: vi.fn(async () => 0), ...over.employee },

    userRole: {
      findMany: vi.fn(async () => [{ role: { name: 'SUPER_ADMIN' } }]),
      ...over.userRole,
    },
  };

  return {
    ...base,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(base),
    ),
  } as unknown as PrismaService;
}

const dto = () => ({ hospitalId: 'h1', name: 'Radiologi' });

describe('EmployeesService.createDepartment', () => {
  it('creates the row and audits it inside the transaction', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: 'd9',
      ...a.data,
    }));
    const prisma = makePrisma({ department: { create } });
    const svc = new EmployeesService(prisma, auditStub);

    const out = (await svc.createDepartment(dto(), 'admin', {
      ip: '1.1.1.1',
    })) as Record<string, unknown>;

    expect(out).toMatchObject({
      id: 'd9',
      hospitalId: 'h1',
      name: 'Radiologi',
    });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DEPARTMENT_CREATED',
        targetType: 'department',
        targetId: 'd9',
      }),
      expect.anything(),
    );
  });

  it('rejects an unknown hospital', async () => {
    const svc = new EmployeesService(
      makePrisma({ hospital: { findUnique: vi.fn(async () => null) } }),
      auditStub,
    );
    await expect(svc.createDepartment(dto(), 'admin')).rejects.toThrow(
      'Hospital not found',
    );
  });

  it('rejects a duplicate name within the same hospital', async () => {
    const svc = new EmployeesService(
      makePrisma({
        department: { findUnique: vi.fn(async () => ({ id: 'dx' })) },
      }),
      auditStub,
    );
    await expect(svc.createDepartment(dto(), 'admin')).rejects.toThrow(
      'already exists',
    );
  });

  it('maps a P2002 race on the unique index to a conflict naming the field', async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error('unique'), {
        code: 'P2002',
        meta: { target: ['hospitalId', 'name'] },
      });
    });
    const svc = new EmployeesService(
      makePrisma({ department: { create } }),
      auditStub,
    );
    await expect(svc.createDepartment(dto(), 'admin')).rejects.toThrow(
      'hospitalId, name already in use',
    );
  });
});

describe('EmployeesService.updateDepartment', () => {
  it('renames and audits', async () => {
    const findUnique = vi.fn(async (a: { where: Record<string, unknown> }) =>
      'id' in a.where ? { id: 'd1', name: 'IGD', hospitalId: 'h1' } : null,
    );
    const svc = new EmployeesService(
      makePrisma({ department: { findUnique } }),
      auditStub,
    );

    const out = (await svc.updateDepartment(
      'd1',
      { name: 'Instalasi Gawat Darurat' },
      'admin',
    )) as Record<string, unknown>;

    expect(out.name).toBe('Instalasi Gawat Darurat');
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEPARTMENT_UPDATED', targetId: 'd1' }),
    );
  });

  it('404s on an unknown id', async () => {
    const svc = new EmployeesService(makePrisma(), auditStub);
    await expect(
      svc.updateDepartment('nope', { name: 'X' }, 'admin'),
    ).rejects.toThrow('Department not found');
  });

  it('rejects renaming onto an existing name of the same hospital', async () => {
    const findUnique = vi.fn(async (a: { where: Record<string, unknown> }) =>
      'id' in a.where
        ? { id: 'd1', name: 'IGD', hospitalId: 'h1' }
        : { id: 'd2', name: 'Radiologi', hospitalId: 'h1' },
    );
    const svc = new EmployeesService(
      makePrisma({ department: { findUnique } }),
      auditStub,
    );
    await expect(
      svc.updateDepartment('d1', { name: 'Radiologi' }, 'admin'),
    ).rejects.toThrow('already exists');
  });
});

describe('EmployeesService.deleteDepartment', () => {
  it('deletes and audits', async () => {
    const del = vi.fn(async () => ({}));
    const svc = new EmployeesService(
      makePrisma({
        department: {
          findUnique: vi.fn(async () => ({ id: 'd1', name: 'IGD' })),
          delete: del,
        },
      }),
      auditStub,
    );

    await expect(svc.deleteDepartment('d1', 'admin')).resolves.toEqual({
      removed: true,
    });

    expect(del).toHaveBeenCalledWith({ where: { id: 'd1' } });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEPARTMENT_DELETED', targetId: 'd1' }),
    );
  });

  it('refuses while employees are still assigned (history protection)', async () => {
    const svc = new EmployeesService(
      makePrisma({
        department: {
          findUnique: vi.fn(async () => ({ id: 'd1', name: 'IGD' })),
        },
        employee: { count: vi.fn(async () => 3) },
      }),
      auditStub,
    );
    await expect(svc.deleteDepartment('d1', 'admin')).rejects.toThrow(
      'still has 3 employee',
    );
  });

  it('404s on an unknown id', async () => {
    const svc = new EmployeesService(makePrisma(), auditStub);
    await expect(svc.deleteDepartment('nope', 'admin')).rejects.toThrow(
      'Department not found',
    );
  });
});

describe('EmployeesService.listHospitals', () => {
  it('returns the reference list used by the master-data forms', async () => {
    const findMany = vi.fn(async () => [
      { id: 'h1', code: 'RS-A', name: 'RS Contoh' },
    ]);
    const svc = new EmployeesService(
      makePrisma({ hospital: { findMany } }),
      auditStub,
    );

    await expect(svc.listHospitals('u1', ['SUPER_ADMIN'])).resolves.toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { code: 'asc' } }),
    );
  });
});

describe('EmployeesService department facility scoping (ADMIN)', () => {
  function scopedPrisma(over: Record<string, Record<string, unknown>> = {}) {
    return makePrisma({
      userRole: { findMany: vi.fn(async () => [{ role: { name: 'ADMIN' } }]) },
      employee: {
        findUnique: vi.fn(async () => ({
          id: 'e-adm',
          department: { hospitalId: 'h1' },
        })),
      },
      ...over,
    });
  }

  it('createDepartment in another hospital reads as 404', async () => {
    const svc = new EmployeesService(scopedPrisma(), auditStub);
    await expect(
      svc.createDepartment({ hospitalId: 'h2', name: 'X' }, 'u-adm'),
    ).rejects.toThrow('Hospital not found');
  });

  it('listDepartments ignores a foreign hospitalId filter', async () => {
    const findMany = vi.fn(async () => []);
    const svc = new EmployeesService(
      scopedPrisma({ department: { findMany } }),
      auditStub,
    );
    await svc.listDepartments('h2', 'u-adm', ['ADMIN']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hospitalId: 'h1' } }),
    );
  });

  it('deleteDepartment in another hospital reads as 404', async () => {
    const svc = new EmployeesService(
      scopedPrisma({
        department: {
          findUnique: vi.fn(async () => ({ id: 'd9', hospitalId: 'h2' })),
        },
      }),
      auditStub,
    );
    await expect(svc.deleteDepartment('d9', 'u-adm')).rejects.toThrow(
      'Department not found',
    );
  });
});
