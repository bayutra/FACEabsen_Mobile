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

 
export function highestRoleRank(roles: string[]): number {
  return maxRank(roles);
}

 
export function satisfiesRole(actorRoles: string[], requiredRole: string): boolean {
  const actor = maxRank(actorRoles);
  const need = roleRank(requiredRole);
  return need > 0 && actor >= need;
}

 
export function canAssignRole(actorRoles: string[], targetRole: string): boolean {
  if (!(ROLES as readonly string[]).includes(targetRole)) return false;
  if (actorRoles.includes('SUPER_ADMIN')) return true;
  return RANK[targetRole as RoleName] < maxRank(actorRoles);
}

 
export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => userPermissions.includes(p));
}
