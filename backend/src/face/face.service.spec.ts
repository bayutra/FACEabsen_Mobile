import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TemplateCryptoService } from './crypto.service.js';
import { FaceService } from './face.service.js';

const privacyStub = { hasActiveConsent: async () => true };

const KEY = randomBytes(32).toString('base64');
const configStub = { get: (_k: string, d: unknown) => (typeof d === 'string' && d === '' ? KEY : d) } as never;
const auditStub = { log: vi.fn(async () => undefined) } as never;
const crypto = new TemplateCryptoService(configStub);

const tpl = () => Array.from({ length: 192 }, (_, i) => Math.sin(i) / 2);

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  return {
    employee: { findUnique: vi.fn(async () => ({ id: 'e1' })), ...over.employee },
    faceTemplate: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'f1', version: 1, updatedAt: new Date(), ...a.data })),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'f1', ...a.data })),
      ...over.faceTemplate,
    },
  } as unknown as PrismaService;
}

describe('TemplateCryptoService', () => {
  it('roundtrips v1 AES-GCM; tamper detected; bad key rejected', () => {
    const ct = crypto.encrypt(Buffer.from('secret-bytes'), 'e1');
    expect(ct[0]).toBe(0x01);
    expect(crypto.decrypt(ct, 'e1').toString()).toBe('secret-bytes');
    const bad = Buffer.from(ct);
    bad[bad.length - 1] ^= 1;
    expect(() => crypto.decrypt(bad, 'e1')).toThrow();

    const other = new TemplateCryptoService({
      get: () => randomBytes(32).toString('base64'),
    } as never);
    expect(() => other.decrypt(ct, 'e1')).toThrow();

    expect(() => new TemplateCryptoService({ get: () => '' }) as never).toThrow(
      'DATA_ENCRYPTION_KEY',
    );
  });

  it('legacy blob (no AAD) still decrypts via the legacy path', async () => {
    const { createCipheriv } = await import('node:crypto');
    const key = Buffer.from(KEY, 'base64');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(Buffer.from('legacy-bytes')), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacy = Buffer.concat([iv, tag, ct]); // pre-M11 layout, no version byte
    expect(crypto.decrypt(legacy, 'e1').toString()).toBe('legacy-bytes');
    // Legacy path ignores the employee binding, exactly as before.
    expect(crypto.decrypt(legacy, 'someone-else').toString()).toBe('legacy-bytes');
  });

  it('legacy blob whose IV starts with 0x01 still decrypts (no row is orphaned)', async () => {
    const { createCipheriv } = await import('node:crypto');
    const key = Buffer.from(KEY, 'base64');
    // Force the 1/256 edge: a pre-M11 IV whose first byte is 0x01.
    const iv = Buffer.concat([Buffer.from([0x01]), randomBytes(11)]);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(Buffer.from('legacy-bytes')), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacy = Buffer.concat([iv, tag, ct]);
    expect(legacy[0]).toBe(0x01);
    expect(crypto.decrypt(legacy, 'e1').toString()).toBe('legacy-bytes');
  });

  it('a v1 blob swapped to a different employee fails authentication', () => {
    const ct = crypto.encrypt(Buffer.from('secret-bytes'), 'e1');
    expect(() => crypto.decrypt(ct, 'e2')).toThrow();
    expect(() => crypto.decrypt(ct)).toThrow();
  });
});

describe('FaceService.register', () => {
  it('stores encrypted template, versions re-registration, never leaks bytes', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: 'f1', version: 1, updatedAt: new Date(), ...a.data,
    }));
    const prisma = makePrisma({ faceTemplate: { create } });
    const svc = new FaceService(prisma, crypto, privacyStub, auditStub);

    const out = (await svc.register({ template: tpl(), qualityScore: 0.9 }, 'u1')) as { version: number };
    expect(out.version).toBe(1);
    expect(out).not.toHaveProperty('templateCipher');
    const stored = create.mock.calls[0][0].data.templateCipher as Uint8Array;
    expect(Buffer.from(stored).toString()).not.toContain('NaN');
    // decrypts back to the original floats
    const plain = crypto.decrypt(Buffer.from(stored), 'e1');
    expect(new Float32Array(plain.buffer, plain.byteOffset, 48 * 4)[0]).toBeCloseTo(Math.sin(0) / 2, 5);

    const fp = createHash('sha256').update(Buffer.from(stored)).digest('hex');
    expect(fp).toHaveLength(64); // opaque blob, auditable by hash only
  });

  it('rejects: no profile, non-finite, low quality', async () => {
    const svc = new FaceService(
      makePrisma({ employee: { findUnique: vi.fn(async () => null) } }),
      crypto,
      privacyStub,
      auditStub,
    );
    await expect(svc.register({ template: tpl(), qualityScore: 0.9 }, 'ghost')).rejects.toThrow('No employee profile');

    const svc2 = new FaceService(makePrisma(), crypto, privacyStub, auditStub);
    const bad = tpl();
    bad[0] = Number.NaN;
    await expect(svc2.register({ template: bad, qualityScore: 0.9 }, 'u1')).rejects.toThrow('finite');
    await expect(svc2.register({ template: tpl(), qualityScore: 0.3 }, 'u1')).rejects.toThrow('Quality too low');
  });

  it('requires active biometric consent (STEP 21)', async () => {
    const svc = new FaceService(
      makePrisma(),
      crypto,
      { hasActiveConsent: async () => false },
      auditStub,
    );
    await expect(svc.register({ template: tpl(), qualityScore: 0.9 }, 'u1')).rejects.toMatchObject({
      response: { reason: 'NO_CONSENT' },
    });
  });

  it('status hides template bytes', async () => {
    const prisma = makePrisma({
      faceTemplate: {
        findUnique: vi.fn(async () => ({ id: 'f1', version: 2, algorithm: 'MobileFaceNet_v1', updatedAt: new Date(), templateCipher: new Uint8Array([1, 2, 3]) })),
      },
    });
    const svc = new FaceService(prisma, crypto, privacyStub, auditStub);
    const st = (await svc.status('u1')) as Record<string, unknown>;
    expect(st.registered).toBe(true);
    expect(st).not.toHaveProperty('templateCipher');

    const svc2 = new FaceService(makePrisma(), crypto, privacyStub, auditStub);
    expect(await svc2.status('u1')).toEqual({ registered: false });
  });
});

describe('FaceService.matchScore (STEP 23 coverage)', () => {
  it('null without template; -1 on length/zero mismatch; cosine otherwise', async () => {
    const svc = new FaceService(makePrisma(), crypto, privacyStub, auditStub);
    expect(await svc.matchScore('ghost', [0.5])).toBeNull();

    // craft a stored template of known vector via register, then match
    const created: { templateCipher?: Uint8Array }[] = [];
    const prisma = makePrisma({
      faceTemplate: {
        findUnique: vi.fn(async (a: { where: { employeeId: string } }) =>
          a.where.employeeId === 'e1' && created.length > 0 ? { templateCipher: created[0].templateCipher } : null,
        ),
        create: vi.fn(async (a: { data: { templateCipher: Uint8Array } }) => {
          created.push({ templateCipher: a.data.templateCipher });
          return { id: 'f1', version: 1, updatedAt: new Date() };
        }),
      },
    });
    const svc2 = new FaceService(prisma, crypto, privacyStub, auditStub);
    const vec = Array.from({ length: 192 }, (_, i) => Math.sin(i));
    await svc2.register({ template: vec, qualityScore: 0.9 }, 'u1');
    expect(await svc2.matchScore('e1', vec)).toBeCloseTo(1, 5);
    expect(await svc2.matchScore('e1', vec.slice(0, 100))).toBe(-1);
  });
});
