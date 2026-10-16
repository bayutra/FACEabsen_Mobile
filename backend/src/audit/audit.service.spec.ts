import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuditService, SECURITY_ACTIONS } from './audit.service.js';

function makePrisma() {
  return {
    auditLog: {
      create: vi.fn(),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
  } as unknown as PrismaService;
}

describe('AuditService.list', () => {
  it('builds filters + envelope; security preset uses curated actions', async () => {
    const findMany = vi.fn(async () => []);
    const count = vi.fn(async () => 5);
    const prisma = makePrisma();
    prisma.auditLog.findMany = findMany;
    prisma.auditLog.count = count;
    const svc = new AuditService(prisma);

    const out = await svc.list({ action: 'LOGIN_FAILED', page: 1, pageSize: 20 });
    expect(out.pagination).toMatchObject({ totalItems: 5, totalPages: 1 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ AND: expect.any(Array) }) }),
    );

    findMany.mockClear();
    await svc.list({ security: true });
    const where = findMany.mock.calls[0][0].where as { AND: Array<{ action?: unknown }> };
    const actionClause = where.AND.find((c) => c.action);
    expect(actionClause).toEqual({ action: { in: [...SECURITY_ACTIONS] } });
  });

  it('actions() returns distinct catalog', async () => {
    const prisma = makePrisma();
    prisma.auditLog.findMany = vi.fn(async () => [{ action: 'B' }, { action: 'A' }]);
    const svc = new AuditService(prisma);
    await expect(svc.actions()).resolves.toEqual(['B', 'A']);
  });
});
