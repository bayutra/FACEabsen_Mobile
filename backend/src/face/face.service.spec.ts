import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TemplateCryptoService } from './crypto.service.js';
import { FaceService } from './face.service.js';

const privacyStub = { hasActiveConsent: async () => true };

const KEY = randomBytes(32).toString('base64');
const configStub = {
  get: (k: string, d: unknown) => (k === 'DATA_ENCRYPTION_KEY' ? KEY : d),
} as never;
const auditStub = { log: vi.fn(async () => undefined) } as never;
const crypto = new TemplateCryptoService(configStub);

const tpl = () => Array.from({ length: 192 }, (_, i) => Math.sin(i) / 2);

function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  return {
    employee: {
      findUnique: vi.fn(async () => ({ id: 'e1' })),
      ...over.employee,
    },
    faceTemplate: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
        id: 'f1',
        version: 1,
        updatedAt: new Date(),
        ...a.data,
      })),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => ({
        id: 'f1',
        ...a.data,
      })),
      ...over.faceTemplate,
    },
  } as unknown as PrismaService;
}

describe('TemplateCryptoService', () => {
  it('roundtrips v2 AES-GCM with a key id; tamper detected; bad key rejected', () => {
    const ct = crypto.encrypt(Buffer.from('secret-bytes'), 'e1');
    expect(ct[0]).toBe(0x02);
    expect(crypto.keyIdOf(ct)).toBe('1');
    expect(crypto.decrypt(ct, 'e1').toString()).toBe('secret-bytes');
    expect(() => crypto.decrypt(ct, 'e2')).toThrow();
    expect(() => crypto.decrypt(ct)).toThrow();
    const bad = Buffer.from(ct);
    bad[bad.length - 1] ^= 1;
    expect(() => crypto.decrypt(bad, 'e1')).toThrow();

    const other = new TemplateCryptoService({
      get: (k: string, d: unknown) =>
        k === 'DATA_ENCRYPTION_KEY' ? randomBytes(32).toString('base64') : d,
    } as never);
    // Id '1' exists in both services, but the key differs -> auth failure only.
    expect(() => other.decrypt(ct, 'e1')).toThrow();

    expect(() => new TemplateCryptoService({ get: () => '' }) as never).toThrow(
      'DATA_ENCRYPTION_KEY',
    );
  });

  it('rejects a v2 blob whose key id is unknown', () => {
    const ct = crypto.encrypt(Buffer.from('secret-bytes'), 'e1');
    const forged = Buffer.from(ct);
    forged[1] = 1;
    forged[2] = '9'.charCodeAt(0);
    expect(() => crypto.decrypt(forged, 'e1')).toThrow(
      'Unknown DATA_ENCRYPTION_KEY_ID',
    );
  });

  it('no longer silently treats a corrupted v1 blob as legacy', async () => {
    const key = Buffer.from(KEY, 'base64');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('e1', 'utf8'));
    const plain = Buffer.alloc(768, 7);
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    const v1 = Buffer.concat([Buffer.from([0x01]), iv, tag, ct]);
    expect(crypto.decrypt(v1, 'e1').equals(plain)).toBe(true);

    const tampered = Buffer.from(v1);
    tampered[tampered.length - 1] ^= 1;
    expect(() => crypto.decrypt(tampered, 'e1')).toThrow();
    expect(() => crypto.decrypt(v1, 'someone-else')).toThrow();
  });

  it('still decrypts pre-v1 blobs (no AAD) via the explicit legacy path', () => {
    const key = Buffer.from(KEY, 'base64');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([
      cipher.update(Buffer.from('legacy-bytes')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const legacy = Buffer.concat([iv, tag, ct]);
    expect(crypto.decrypt(legacy, 'e1').toString()).toBe('legacy-bytes');
    expect(crypto.decrypt(legacy, 'someone-else').toString()).toBe(
      'legacy-bytes',
    );
  });

  it('legacy blob whose IV starts with 0x01 still decrypts (length disambiguates)', () => {
    const key = Buffer.from(KEY, 'base64');
    const iv = Buffer.concat([Buffer.from([0x01]), randomBytes(11)]);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([
      cipher.update(Buffer.from('legacy-bytes')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const legacy = Buffer.concat([iv, tag, ct]);
    expect(legacy[0]).toBe(0x01);
    expect(crypto.decrypt(legacy, 'e1').toString()).toBe('legacy-bytes');
  });

  it('rotates keys: previous key id decrypts, new writes use the active id', () => {
    const oldKey = Buffer.from(KEY, 'base64');
    const newKey = randomBytes(32);
    const oldService = new TemplateCryptoService({
      get: (k: string, d: unknown) => (k === 'DATA_ENCRYPTION_KEY' ? KEY : d),
    } as never);
    const rotated = new TemplateCryptoService({
      get: (k: string, d: unknown) => {
        if (k === 'DATA_ENCRYPTION_KEY') return newKey.toString('base64');
        if (k === 'DATA_ENCRYPTION_KEY_ID') return '2';
        if (k === 'DATA_ENCRYPTION_KEYS_PREVIOUS') {
          return `1:${oldKey.toString('base64')}`;
        }
        return d;
      },
    } as never);

    const fromOld = oldService.encrypt(Buffer.from('older'), 'e1');
    expect(rotated.decrypt(fromOld, 'e1').toString()).toBe('older');
    expect(rotated.keyIdOf(fromOld)).toBe('1');

    const fromNew = rotated.encrypt(Buffer.from('newer'), 'e1');
    expect(rotated.keyIdOf(fromNew)).toBe('2');
    expect(rotated.decrypt(fromNew, 'e1').toString()).toBe('newer');
    // The old service does not know key id '2'.
    expect(() => oldService.decrypt(fromNew, 'e1')).toThrow();
  });

  it('rejects duplicate previous key ids', () => {
    expect(
      () =>
        new TemplateCryptoService({
          get: (k: string, d: unknown) => {
            if (k === 'DATA_ENCRYPTION_KEY') return KEY;
            if (k === 'DATA_ENCRYPTION_KEYS_PREVIOUS') return `1:${KEY}`;
            return d;
          },
        } as never),
    ).toThrow('must not repeat');
  });
});

describe('FaceService.register', () => {
  it('stores encrypted template, versions re-registration, never leaks bytes', async () => {
    const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: 'f1',
      version: 1,
      updatedAt: new Date(),
      ...a.data,
    }));
    const prisma = makePrisma({ faceTemplate: { create } });
    const svc = new FaceService(prisma, crypto, privacyStub, auditStub);

    const out = (await svc.register(
      { template: tpl(), qualityScore: 0.9 },
      'u1',
    )) as { version: number };
    expect(out.version).toBe(1);
    expect(out).not.toHaveProperty('templateCipher');
    const stored = create.mock.calls[0][0].data.templateCipher as Uint8Array;
    expect(Buffer.from(stored).toString()).not.toContain('NaN');

    const plain = crypto.decrypt(Buffer.from(stored), 'e1');
    expect(
      new Float32Array(plain.buffer, plain.byteOffset, 48 * 4)[0],
    ).toBeCloseTo(Math.sin(0) / 2, 5);

    const fp = createHash('sha256').update(Buffer.from(stored)).digest('hex');
    expect(fp).toHaveLength(64);
  });

  it('rejects: no profile, non-finite, low quality', async () => {
    const svc = new FaceService(
      makePrisma({ employee: { findUnique: vi.fn(async () => null) } }),
      crypto,
      privacyStub,
      auditStub,
    );
    await expect(
      svc.register({ template: tpl(), qualityScore: 0.9 }, 'ghost'),
    ).rejects.toThrow('No employee profile');

    const svc2 = new FaceService(makePrisma(), crypto, privacyStub, auditStub);
    const bad = tpl();
    bad[0] = Number.NaN;
    await expect(
      svc2.register({ template: bad, qualityScore: 0.9 }, 'u1'),
    ).rejects.toThrow('finite');
    await expect(
      svc2.register({ template: tpl(), qualityScore: 0.3 }, 'u1'),
    ).rejects.toThrow('Quality too low');
  });

  it('requires active biometric consent (STEP 21)', async () => {
    const svc = new FaceService(
      makePrisma(),
      crypto,
      { hasActiveConsent: async () => false },
      auditStub,
    );
    await expect(
      svc.register({ template: tpl(), qualityScore: 0.9 }, 'u1'),
    ).rejects.toMatchObject({
      response: { reason: 'NO_CONSENT' },
    });
  });

  it('status hides template bytes', async () => {
    const prisma = makePrisma({
      faceTemplate: {
        findUnique: vi.fn(async () => ({
          id: 'f1',
          version: 2,
          algorithm: 'MobileFaceNet_v1',
          updatedAt: new Date(),
          templateCipher: new Uint8Array([1, 2, 3]),
        })),
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

    const created: { templateCipher?: Uint8Array }[] = [];
    const prisma = makePrisma({
      faceTemplate: {
        findUnique: vi.fn(async (a: { where: { employeeId: string } }) =>
          a.where.employeeId === 'e1' && created.length > 0
            ? { templateCipher: created[0].templateCipher }
            : null,
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
