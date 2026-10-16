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

/**
 * Tahap 2 — hospital tenant scoping.
 *
 * - SUPER_ADMIN is system-global (the only role that may cross facilities).
 * - Everyone else resolves to their own facility via
 *   employee → department → hospitalId, loaded server-side (never trusted
 *   from request parameters).
 * - Accounts with no employee row, or an employee with no department, get
 *   NO facility (fail closed: callers must return empty / 404).
 */
export async function resolveHospitalScope(
  prisma: ScopePrisma,
  userId: string,
  roles: string[],
): Promise<HospitalScope> {
  if (satisfiesRole(roles, 'SUPER_ADMIN')) return { kind: 'global' };
  // NB: `include` (not `select`) so in-memory doubles and hand-rolled fakes
  // resolve the relation the same way production Prisma does.
  const me = await prisma.employee.findUnique({
    where: { userId },
    include: { department: { select: { hospitalId: true } } },
  });
  const hospitalId = me?.department?.hospitalId;
  if (!hospitalId) return { kind: 'none' };
  return { kind: 'hospital', hospitalId };
}
