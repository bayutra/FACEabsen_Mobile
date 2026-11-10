import { satisfiesRole } from './rbac.js';

export type HospitalScope =
  | { kind: 'global' }
  | { kind: 'hospital'; hospitalId: string }
  | { kind: 'none' };

interface ScopePrisma {
  employee: {
    findUnique(args: unknown): Promise<any>;
  };
}

export async function resolveHospitalScope(
  prisma: ScopePrisma,
  userId: string,
  roles: string[],
): Promise<HospitalScope> {
  if (satisfiesRole(roles, 'SUPER_ADMIN')) return { kind: 'global' };

  const me = await prisma.employee.findUnique({
    where: { userId },
    include: { department: { select: { hospitalId: true } } },
  });
  const hospitalId = me?.department?.hospitalId;
  if (!hospitalId) return { kind: 'none' };
  return { kind: 'hospital', hospitalId };
}

/**
 * Builds the tenant-scoped WHERE for an employee-scoped query.
 *
 * - SUPER_ADMIN            -> the base filter unchanged
 * - ADMIN (non-super)      -> base AND employee.department.hospitalId = <hospital>
 * - everyone else (incl. SUPERVISOR/team reviewer) -> base AND employee.departmentId = <reviewer.departmentId> (same unit/department)
 *
 * Returns `{ AND: [base, ...tenant] }` (or `null` when the caller has no
 * visible employees, or the non-admin reviewer has no employee/departmentId),
 * so callers can spread it directly into a Prisma where. Callers may append
 * extra predicates to `where.AND`.
 */
export async function resolveEmployeeTenantWhere(
  prisma: ScopePrisma,
  userId: string,
  roles: string[],
  base: Record<string, unknown>,
): Promise<{ AND: Array<Record<string, unknown>> } | null> {
  const and: Array<Record<string, unknown>> = [];
  if (Object.keys(base).length > 0) and.push(base);
  if (satisfiesRole(roles, 'SUPER_ADMIN')) return { AND: and };

  if (!satisfiesRole(roles, 'ADMIN')) {
    const me = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true, departmentId: true, department: { select: { hospitalId: true } } },
    });
    if (!me || !me.departmentId) return null;
    and.push({ employee: { departmentId: me.departmentId } });
    return { AND: and };
  }

  const scope = await resolveHospitalScope(prisma, userId, roles);
  if (scope.kind !== 'hospital') return null;
  and.push({ employee: { department: { hospitalId: scope.hospitalId } } });
  return { AND: and };
}
