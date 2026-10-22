import { describe, expect, it } from 'vitest';
import { effectivePermissions, ROLE_PERMISSIONS } from './constants.js';
import { canAssignRole, hasAllPermissions, satisfiesRole } from './rbac.js';

describe('satisfiesRole (rank-inclusive)', () => {
  it('higher ranks satisfy lower requirements; never the reverse', () => {
    expect(satisfiesRole(['SUPER_ADMIN'], 'ADMIN')).toBe(true);
    expect(satisfiesRole(['ADMIN'], 'EMPLOYEE')).toBe(true);
    expect(satisfiesRole(['SUPERVISOR'], 'SUPER_ADMIN')).toBe(false);
    expect(satisfiesRole(['EMPLOYEE'], 'ADMIN')).toBe(false);
    expect(satisfiesRole([], 'EMPLOYEE')).toBe(false);
  });
});

describe('canAssignRole (PRD §48 acceptance)', () => {
  it('SUPER_ADMIN can grant any role', () => {
    for (const r of ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN']) {
      expect(canAssignRole(['SUPER_ADMIN'], r)).toBe(true);
    }
  });

  it('ADMIN cannot grant SUPER_ADMIN (acceptance)', () => {
    expect(canAssignRole(['ADMIN'], 'SUPER_ADMIN')).toBe(false);
  });

  it('ADMIN cannot grant another ADMIN (least privilege)', () => {
    expect(canAssignRole(['ADMIN'], 'ADMIN')).toBe(false);
  });

  it('ADMIN can grant SUPERVISOR and EMPLOYEE', () => {
    expect(canAssignRole(['ADMIN'], 'SUPERVISOR')).toBe(true);
    expect(canAssignRole(['ADMIN'], 'EMPLOYEE')).toBe(true);
  });

  it('SUPERVISOR can grant EMPLOYEE only', () => {
    expect(canAssignRole(['SUPERVISOR'], 'EMPLOYEE')).toBe(true);
    expect(canAssignRole(['SUPERVISOR'], 'SUPERVISOR')).toBe(false);
    expect(canAssignRole(['SUPERVISOR'], 'ADMIN')).toBe(false);
  });

  it('EMPLOYEE cannot grant anything; unknown roles rejected', () => {
    expect(canAssignRole(['EMPLOYEE'], 'EMPLOYEE')).toBe(false);
    expect(canAssignRole(['ADMIN'], 'GHOST')).toBe(false);
    expect(canAssignRole([], 'EMPLOYEE')).toBe(false);
  });
});

describe('permission catalog', () => {
  it('SUPER_ADMIN-exclusive keys exist only at top rank', () => {
    expect(ROLE_PERMISSIONS.EMPLOYEE).not.toContain('role:manage');
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('role:manage');
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('security:manage');
    expect(effectivePermissions('SUPER_ADMIN')).toContain('role:manage');
    expect(effectivePermissions('ADMIN')).not.toContain('role:manage');
  });

  it('hasAllPermissions denies by default', () => {
    expect(hasAllPermissions([], ['device:revoke'])).toBe(false);
    expect(
      hasAllPermissions(['device:read'], ['device:read', 'device:revoke']),
    ).toBe(false);
    expect(
      hasAllPermissions(['device:read', 'device:revoke'], ['device:revoke']),
    ).toBe(true);
    expect(hasAllPermissions(['a'], [])).toBe(true);
  });
});
