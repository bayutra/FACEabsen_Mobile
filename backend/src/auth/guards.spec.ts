import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { AuthService } from './auth.service.js';
import { RequirePermissions, Roles } from './decorators.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

function mockCtx(
  auth: unknown,
  handler: (...args: unknown[]) => unknown,
  target: object,
) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ auth, headers: {} }) }),
    getHandler: () => handler,
    getClass: () => target,
  } as unknown as Parameters<RolesGuard['canActivate']>[0];
}

class Dummy {
  @Roles('ADMIN')
  adminOnly() {}

  @Roles('SUPER_ADMIN')
  superOnly() {}

  @RequirePermissions('role:manage')
  roleManage() {}

  open() {}
}

describe('RolesGuard (PRD §48 acceptance)', () => {
  const guard = new RolesGuard(new Reflector());

  it('ADMIN route: EMPLOYEE denied', () => {
    const ctx = mockCtx(
      { roles: ['EMPLOYEE'] },
      Dummy.prototype.adminOnly,
      Dummy,
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('ADMIN route: ADMIN allowed, SUPER_ADMIN allowed', () => {
    expect(
      guard.canActivate(
        mockCtx({ roles: ['ADMIN'] }, Dummy.prototype.adminOnly, Dummy),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        mockCtx({ roles: ['SUPER_ADMIN'] }, Dummy.prototype.adminOnly, Dummy),
      ),
    ).toBe(true);
  });

  it('SUPER_ADMIN route: SUPERVISOR denied (acceptance)', () => {
    const ctx = mockCtx(
      { roles: ['SUPERVISOR'] },
      Dummy.prototype.superOnly,
      Dummy,
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('no metadata passes; missing auth denied', () => {
    expect(
      guard.canActivate(
        mockCtx({ roles: ['EMPLOYEE'] }, Dummy.prototype.open, Dummy),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(mockCtx(undefined, Dummy.prototype.adminOnly, Dummy)),
    ).toThrow(ForbiddenException);
  });
});

describe('PermissionsGuard', () => {
  const authStub = {
    getPermissions: vi.fn(async (userId: string) =>
      userId === 'u-admin'
        ? ['device:revoke', 'audit:read']
        : ['attendance:read:self'],
    ),
  } as unknown as AuthService;
  const guard = new PermissionsGuard(new Reflector(), authStub);

  it('ADMIN without role:manage denied on role:manage route (acceptance)', async () => {
    const ctx = mockCtx(
      { userId: 'u-admin' },
      Dummy.prototype.roleManage,
      Dummy,
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN perms allowed', async () => {
    const stub = {
      getPermissions: vi.fn(async () => ['role:manage']),
    } as unknown as AuthService;
    const g = new PermissionsGuard(new Reflector(), stub);
    const ctx = mockCtx(
      { userId: 'u-super' },
      Dummy.prototype.roleManage,
      Dummy,
    );
    await expect(g.canActivate(ctx)).resolves.toBe(true);
  });
});

describe('JwtAuthGuard', () => {
  it('missing bearer is 401', async () => {
    const guard = new JwtAuthGuard({} as never, {} as never, new Reflector());
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => Dummy.prototype.open,
      getClass: () => Dummy,
    } as never;
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Missing access token',
    );
  });
});
