import { describe, expect, it, vi } from 'vitest';
import { resolveEmployeeTenantWhere } from './tenant-scope.js';

const prismaOf = (reviewer: any) => ({
  employee: { findUnique: vi.fn(async () => reviewer) },
}) as any;

describe('resolveEmployeeTenantWhere (supervisor unit scope)', () => {
  it('scopes non-admin reviewer to their departmentId (unit)', async () => {
    const prisma = prismaOf({ id: 'e-sup', departmentId: 'd1', department: { hospitalId: 'h1' } });
    const where = await resolveEmployeeTenantWhere(prisma, 'u-sup', ['SUPERVISOR'], { status: 'PENDING' });
    expect(where).toEqual({ AND: [{ status: 'PENDING' }, { employee: { departmentId: 'd1' } }] });
  });

  it('returns null when reviewer has no employee or no departmentId', async () => {
    expect(await resolveEmployeeTenantWhere(prismaOf(null), 'u', ['SUPERVISOR'], {})).toBeNull();
    expect(await resolveEmployeeTenantWhere(prismaOf({ id: 'e', departmentId: null }), 'u', ['SUPERVISOR'], {})).toBeNull();
  });

  it('keeps ADMIN hospital scope and SUPER_ADMIN global behavior', async () => {
    const adminPrisma = prismaOf({ id: 'e-adm', departmentId: 'd1', department: { hospitalId: 'h1' } });
    const admin = await resolveEmployeeTenantWhere(adminPrisma, 'u-adm', ['ADMIN'], {});
    expect(JSON.stringify(admin)).toContain('hospitalId');
    const sup = await resolveEmployeeTenantWhere(prismaOf(null), 'u-sa', ['SUPER_ADMIN'], { x: 1 });
    expect(sup).toEqual({ AND: [{ x: 1 }] });
  });
});
