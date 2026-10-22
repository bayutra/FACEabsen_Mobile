


export const ROLES = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

 
export const PERMISSIONS = [
  
  'attendance:create:self',
  'attendance:read:self',
  'correction:create:self',
  'leave:create:self',
  
  'attendance:read:team',
  'attendance:approve:team',
  'correction:approve:team',
  'leave:approve:team',
  'report:read:team',
  
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
  
  'role:manage',
  'security:manage',
  'system:manage',
] as const;

 
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
    
    
    'employee:read',
    'employee:update',
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
  accessTtlSec: 15 * 60, 
  refreshTtlDays: 7,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  loginThrottle: { limit: 10, ttl: 60_000 }, 
  password: { minLength: 8 },
   
  jwtAlgorithm: 'HS256',
  jwtIssuer: 'face-absen',
  jwtMinSecretLength: 32,
} as const;
