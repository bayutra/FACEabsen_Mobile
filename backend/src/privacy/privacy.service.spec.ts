import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from './privacy.service.js';

const auditStub = { log: vi.fn(async () => undefined) } as never;
const configStub = { get: (_k: string, d: unknown) => d } as never;

function makePrisma(consentRow: unknown = null) {
  return {
    employee: { findUnique: vi.fn(async () => ({ id: 'e1' })) },
    consent: {
      findUnique: vi.fn(async () => consentRow),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (a: { data: object }) => ({ id: 'c1', ...a.data })),
      update: vi.fn(async (a: { where: { id: string }; data: object }) => ({ id: a.where.id, ...a.data })),
    },
    device: { findMany: vi.fn(async () => [{ id: 'd1', devicePublicKey: 'secret-key-material' }]) },
    attendance: { findMany: vi.fn(async () => []) },
    faceTemplate: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    session: { deleteMany: vi.fn(async () => ({ count: 2 })) },
    idempotencyKey: { deleteMany: vi.fn(async () => ({ count: 5 })) },
  } as unknown as PrismaService;
}

describe('PrivacyService consent', () => {
  it('grants, re-grants idempotently, revokes; hasActive reflects revocation', async () => {
    const prisma = makePrisma();
    const svc = new PrivacyService(prisma, auditStub, configStub);

    const g = (await svc.grantOrRevoke('u1', 'BIOMETRIC_ATTENDANCE', true)) as { granted: boolean };
    expect(g.granted).toBe(true);
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONSENT_GRANTED' }));

    expect(await svc.hasActiveConsent('e1', 'BIOMETRIC_ATTENDANCE')).toBe(false); 

    const prisma2 = makePrisma({ id: 'c1', revokedAt: null });
    const svc2 = new PrivacyService(prisma2, auditStub, configStub);
    expect(await svc2.hasActiveConsent('e1', 'BIOMETRIC_ATTENDANCE')).toBe(true);

    const prisma3 = makePrisma({ id: 'c1', revokedAt: new Date() });
    expect(await new PrivacyService(prisma3, auditStub, configStub).hasActiveConsent('e1', 'BIOMETRIC_ATTENDANCE')).toBe(false);
  });

  it('notice is versioned', () => {
    const svc = new PrivacyService(makePrisma(), auditStub, configStub);
    const n = svc.notice() as { version: string; body: string[] };
    expect(n.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.body.length).toBeGreaterThan(0);
  });
});

describe('PrivacyService export/erase/retention', () => {
  it('export redacts keys and hides template bytes', async () => {
    const svc = new PrivacyService(makePrisma(), auditStub, configStub);
    const out = (await svc.exportMine('u1')) as {
      devices: Array<{ devicePublicKey: string }>;
      faceRegistered: boolean;
    };
    expect(out.devices[0].devicePublicKey).toBe('[redacted]');
    expect(out.faceRegistered).toBe(false);
    expect(out).not.toHaveProperty('templateCipher');
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DATA_EXPORTED' }));
  });

  it('eraseFace deletes + audits', async () => {
    const del = vi.fn(async () => ({ count: 1 }));
    const prisma = makePrisma();
    prisma.faceTemplate.deleteMany = del;
    const svc = new PrivacyService(prisma, auditStub, configStub);
    await expect(svc.eraseFace('u1')).resolves.toEqual({ deleted: true });
    expect(del).toHaveBeenCalled();
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'FACE_DELETED' }));
  });

  it('retention purges expired sessions/keys/stale inactive faces + audits', async () => {
    const faceDel = vi.fn(async () => ({}));
    const prisma = makePrisma();
    prisma.faceTemplate.findMany = vi.fn(async () => [{ id: 'f-old' }]);
    prisma.faceTemplate.delete = faceDel;
    const svc = new PrivacyService(prisma, auditStub, configStub);
    const out = await svc.runRetention('admin');
    expect(out).toEqual({ sessions: 2, idempotencyKeys: 5, faceTemplates: 1 });
    expect(faceDel).toHaveBeenCalledWith({ where: { id: 'f-old' } });
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'RETENTION_RUN' }));
  });
});
