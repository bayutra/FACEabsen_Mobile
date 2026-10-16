// STEP 3 — canonical roles, permissions & auth policy (PRD §7, §8, §35).
// UI hiding is NOT security: every key below is enforced server-side by guards.

export const ROLES = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

/** Canonical permission catalog (resource:action). Extended by later STEPs. */
export const PERMISSIONS = [
  // self (employee)
  'attendance:create:self',
  'attendance:read:self',
  'correction:create:self',
  'leave:create:self',
  // team (supervisor)
  'attendance:read:team',
  'attendance:approve:team',
  'correction:approve:team',
  'leave:approve:team',
  'report:read:team',
  // admin
  'employee:create',
  'employee:update',
  'employee:read',
  'attendance:read',
  'department:manage',
  'device:read',
  'device:revoke',
  'device:approve-replacement',
  'shift:manage',
  'schedule:manage',
  'report:read',
  'audit:read',
  // Delegable administration. Deliberately NOT in SUPER_ADMIN_ONLY: ADMIN may
  // provision accounts, and rbac.canAssignRole stops them from minting an
  // ADMIN or SUPER_ADMIN. UsersService additionally refuses to touch accounts
  // whose rank is >= the actor's, so delegation stays bounded.
  'user:manage',
  // super admin only
  'role:manage',
  'security:manage',
  'system:manage',
] as const;

/** Cumulative role grants. SUPER_ADMIN-exclusive keys must never be granted below. */
export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  EMPLOYEE: [
    'attendance:create:self',
    'attendance:read:self',
    'correction:create:self',
    'leave:create:self',
  ],
  SUPERVISOR: [
    'attendance:read:team',
    'attendance:approve:team',
    'correction:approve:team',
    'leave:approve:team',
    'report:read:team',
  ],
  ADMIN: [
    'employee:create',
    'employee:update',
    'employee:read',
    'attendance:read',
    'department:manage',
    'device:read',
    'device:revoke',
    'device:approve-replacement',
    'shift:manage',
    'schedule:manage',
    'report:read',
    'audit:read',
    'user:manage',
  ],
  SUPER_ADMIN: ['role:manage', 'security:manage', 'system:manage'],
};

/** Permissions effective for a role, including all lower ranks. */
export function effectivePermissions(role: RoleName): string[] {
  const rank: Record<RoleName, number> = {
    EMPLOYEE: 1,
    SUPERVISOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4,
  };
  const out = new Set<string>();
  for (const r of ROLES) {
    if (rank[r] <= rank[role]) for (const p of ROLE_PERMISSIONS[r]) out.add(p);
  }
  return [...out];
}

export const SUPER_ADMIN_ONLY = ['role:manage', 'security:manage', 'system:manage'];

export const AUTH_POLICY = {
  accessTtlSec: 15 * 60, // short-lived access token (PRD §7)
  refreshTtlDays: 7,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  loginThrottle: { limit: 10, ttl: 60_000 }, // + global 600/min (per-user buckets; Redis in prod STEP 25)
  password: { minLength: 8 },
  /** JWT hardening (STEP 22): pinned algorithm + issuer, no alg confusion. */
  jwtAlgorithm: 'HS256',
  jwtIssuer: 'face-absen',
  jwtMinSecretLength: 32,
} as const;
