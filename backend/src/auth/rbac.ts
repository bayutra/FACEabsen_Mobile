import { ROLES, type RoleName } from './constants.js';

const RANK: Record<RoleName, number> = {
  EMPLOYEE: 1,
  SUPERVISOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

const maxRank = (roles: string[]): number =>
  Math.max(
    0,
    ...roles
      .filter((r) => (ROLES as readonly string[]).includes(r))
      .map((r) => RANK[r as RoleName]),
  );

export function roleRank(role: string): number {
  return (RANK as Record<string, number>)[role] ?? 0;
}

/**
 * Highest rank held in `roles` (0 when none are known roles). Used to bound
 * delegation: an actor may only administer accounts ranked strictly below
 * their own, unless they are SUPER_ADMIN.
 */
export function highestRoleRank(roles: string[]): number {
  return maxRank(roles);
}

/**
 * Rank-inclusive role check: an actor satisfies a required role when their
 * highest rank meets or exceeds it (SUPER_ADMIN passes ADMIN routes, etc.).
 * Upward exclusion still holds: lower ranks never satisfy higher requirements.
 */
export function satisfiesRole(actorRoles: string[], requiredRole: string): boolean {
  const actor = maxRank(actorRoles);
  const need = roleRank(requiredRole);
  return need > 0 && actor >= need;
}

/**
 * May `actorRoles` grant `targetRole` to someone else?
 * Rule (least privilege): actor may only grant roles strictly below their own
 * max rank; SUPER_ADMIN may grant anything (including SUPER_ADMIN).
 * Consequence (PRD §48 acceptance): ADMIN can never create/grant SUPER_ADMIN
 * (or another ADMIN) — that requires a SUPER_ADMIN.
 */
export function canAssignRole(actorRoles: string[], targetRole: string): boolean {
  if (!(ROLES as readonly string[]).includes(targetRole)) return false;
  if (actorRoles.includes('SUPER_ADMIN')) return true;
  return RANK[targetRole as RoleName] < maxRank(actorRoles);
}

/** All `required` permissions must be present (deny by default). */
export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => userPermissions.includes(p));
}
