// TotpService: enrollment, verification, and single-use recovery (DB-free fakes).
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { totp } from './totp.js';
import { TotpService } from './totp.service.js';

const PASSWORD = 'Password123!';
let HASH = '';

const configStub = { get: (_key: string, dflt: unknown) => dflt } as never;
const auditStub = { log: vi.fn(async () => undefined) } as never;
const jwt = new JwtService({ secret: 'test-secret' });

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'employee@rs.test',
    passwordHash: HASH,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    totpSecret: null,
    totpEnabled: false,
    ...over,
  };
}

/** Minimal in-memory Prisma double with real CAS semantics on updateMany. */
function makeDb() {
  const users = new Map<string, any>();
  const codes = new Map<string, any>();
  let seq = 0;
  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where, include }: any) => {
        const u = users.get(where.id) ?? null;
        if (!u) return null;
        if (include?.userRoles) {
          return { ...u, userRoles: [{ role: { name: 'EMPLOYEE' } }] };
        }
        return { ...u };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        Object.assign(u, data);
        return { ...u };
      }),
    },
    totpRecoveryCode: {
      findMany: vi.fn(async ({ where }: any) =>
        [...codes.values()]
          .filter((c) => (!where?.userId || c.userId === where.userId) && (where?.usedAt !== null || c.usedAt == null))
          .map((c) => ({ ...c })),
      ),
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (const [id, c] of codes) {
          if (!where?.userId || c.userId === where.userId) {
            codes.delete(id);
            count++;
          }
        }
        return { count };
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (const d of data) {
          const id = `c${++seq}`;
          codes.set(id, { id, usedAt: null, createdAt: new Date(), ...d });
        }
        return { count: data.length };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const c of codes.values()) {
          if (where?.id && c.id !== where.id) continue;
          if (where?.userId && c.userId !== where.userId) continue;
          if (where?.usedAt === null && c.usedAt != null) continue;
          Object.assign(c, data);
          count++;
        }
        return { count };
      }),
    },
    session: {
      create: vi.fn(async ({ data }: any) => ({
        id: `s${++seq}`,
        createdAt: new Date(),
        revokedAt: null,
        deviceId: null,
        ...data,
      })),
    },
  };
  return { users, codes, prisma };
}

function service(prisma: unknown) {
  return new TotpService(prisma as never, jwt, configStub, auditStub);
}

beforeAll(async () => {
  HASH = await argon2.hash(PASSWORD);
});

describe('TotpService.setup/enable', () => {
  it('setup stores a fresh pending secret and returns the exact otpauth URI', async () => {
    const { users, prisma } = makeDb();
    users.set('u1', userRow());
    const svc = service(prisma);
    const out = await svc.setup('u1');
    expect(out.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(out.otpauthUri).toBe(
      `otpauth://totp/face-absen:employee@rs.test?secret=${out.secret}` +
        `&issuer=face-absen&algorithm=SHA1&digits=6&period=30`,
    );
    expect(users.get('u1').totpSecret).toBe(out.secret);
    expect(users.get('u1').totpEnabled).toBe(false);
  });

  it('setup for an unknown user is 404', async () => {
    const { prisma } = makeDb();
    await expect(service(prisma).setup('ghost')).rejects.toThrow('User not found');
  });

  it('enable with the correct code activates TOTP and mints 8 readable codes', async () => {
    const { users, codes, prisma } = makeDb();
    users.set('u1', userRow());
    const svc = service(prisma);
    const { secret } = await svc.setup('u1');
    const out = await svc.enable('u1', totp(secret));
    expect(out.recoveryCodes).toHaveLength(8);
    for (const c of out.recoveryCodes) {
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{6}$/);
    }
    expect(new Set(out.recoveryCodes).size).toBe(8);
    expect(users.get('u1').totpEnabled).toBe(true);
    // Only hashes persisted — plaintext never touches the store.
    expect(codes.size).toBe(8);
    for (const row of codes.values()) {
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(row)).not.toContain(out.recoveryCodes[0]);
    }
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TOTP_ENABLED' }));
  });

  it('enable with a wrong code is 401, stays disabled, and audits TOTP_FAILED', async () => {
    const { users, prisma } = makeDb();
    users.set('u1', userRow());
    const svc = service(prisma);
    const { secret } = await svc.setup('u1');
    const current = totp(secret);
    const wrong = current === '000000' ? '000001' : '000000';
    await expect(svc.enable('u1', wrong)).rejects.toThrow('Invalid code');
    expect(users.get('u1').totpEnabled).toBe(false);
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TOTP_FAILED', result: 'FAILED' }),
    );
  });

  it('enable rejects re-enrollment (409) and enabling without setup (400)', async () => {
    const { users, prisma } = makeDb();
    users.set('u1', userRow({ totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' }));
    await expect(service(prisma).enable('u1', '123456')).rejects.toThrow('already enabled');
    users.set('u2', userRow({ id: 'u2' }));
    await expect(service(prisma).enable('u2', '123456')).rejects.toThrow('not been started');
  });
});

describe('TotpService.disable', () => {
  it('wrong password is 401 and keeps TOTP on', async () => {
    const { users, prisma } = makeDb();
    users.set('u1', userRow({ totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' }));
    await expect(service(prisma).disable('u1', 'Wrong123!')).rejects.toThrow(
      'Current password is incorrect',
    );
    expect(users.get('u1').totpEnabled).toBe(true);
  });

  it('correct password clears secret, codes, and flag', async () => {
    const { users, codes, prisma } = makeDb();
    users.set('u1', userRow({ totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' }));
    codes.set('c1', { id: 'c1', userId: 'u1', codeHash: 'ab'.repeat(32), usedAt: null });
    const out = await service(prisma).disable('u1', PASSWORD, { ip: '1.2.3.4' });
    expect(out).toEqual({ disabled: true });
    expect(users.get('u1')).toMatchObject({ totpSecret: null, totpEnabled: false });
    expect(codes.size).toBe(0);
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TOTP_DISABLED' }));
  });
});

describe('TotpService challenge tokens', () => {
  it('sign/verify round-trips the userId', async () => {
    const { prisma } = makeDb();
    const svc = service(prisma);
    const token = await svc.signTotpToken('u1');
    await expect(svc.verifyTotpToken(token)).resolves.toBe('u1');
  });

  it('rejects expired tokens, foreign secrets, and plain access tokens', async () => {
    const { prisma } = makeDb();
    const svc = service(prisma);
    const expired = await jwt.signAsync(
      { sub: 'u1', purpose: 'totp' },
      { algorithm: 'HS256', issuer: 'face-absen', expiresIn: -10 },
    );
    await expect(svc.verifyTotpToken(expired)).rejects.toThrow('Invalid or expired token');
    await expect(svc.verifyTotpToken('not-a-jwt')).rejects.toThrow('Invalid or expired token');
    const foreign = await new JwtService({ secret: 'other-secret' }).signAsync(
      { sub: 'u1', purpose: 'totp' },
      { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 300 },
    );
    await expect(svc.verifyTotpToken(foreign)).rejects.toThrow('Invalid or expired token');
    // A normal access token (no totp purpose) must NOT pass as a challenge.
    const accessLike = await jwt.signAsync(
      { sub: 'u1', email: 'e@rs.test', roles: [], sid: 's1' },
      { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 },
    );
    await expect(svc.verifyTotpToken(accessLike)).rejects.toThrow('Invalid or expired token');
  });
});

describe('TotpService.verify', () => {
  async function enrolled() {
    const { users, codes, prisma } = makeDb();
    users.set('u1', userRow());
    const svc = service(prisma);
    const { secret } = await svc.setup('u1');
    await svc.enable('u1', totp(secret));
    const token = await svc.signTotpToken('u1');
    return { users, codes, prisma, svc, secret, token };
  }

  it('correct code returns a full login response with LOGIN_SUCCESS', async () => {
    const { svc, secret, token } = await enrolled();
    const out = await svc.verify(token, totp(secret), { ip: '1.2.3.4' });
    expect(out.accessToken).toBeTruthy();
    expect(out.refreshToken).toBeTruthy();
    expect(out.expiresIn).toBe(15 * 60);
    expect(out.user).toMatchObject({ id: 'u1', email: 'employee@rs.test', roles: ['EMPLOYEE'] });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_SUCCESS', actorId: 'u1' }),
    );
  });

  it('wrong code is 401 with TOTP_FAILED and creates no session', async () => {
    const { prisma, svc, secret, token } = await enrolled();
    const current = totp(secret);
    const wrong = current === '000000' ? '000001' : '000000';
    await expect(svc.verify(token, wrong, {})).rejects.toThrow('Invalid code');
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TOTP_FAILED', result: 'FAILED' }),
    );
  });

  it('expired challenge token is 401', async () => {
    const { svc } = await enrolled();
    const expired = await jwt.signAsync(
      { sub: 'u1', purpose: 'totp' },
      { algorithm: 'HS256', issuer: 'face-absen', expiresIn: -10 },
    );
    await expect(svc.verify(expired, '123456', {})).rejects.toThrow('Invalid or expired token');
  });
});

describe('TotpService.recover', () => {
  async function enrolled() {
    const { users, codes, prisma } = makeDb();
    users.set('u1', userRow());
    const svc = service(prisma);
    const { secret } = await svc.setup('u1');
    const { recoveryCodes } = await svc.enable('u1', totp(secret));
    const token = await svc.signTotpToken('u1');
    return { users, codes, prisma, svc, recoveryCodes, token };
  }

  it('valid code logs in and consumes the code (reuse rejected)', async () => {
    const { codes, svc, recoveryCodes, token } = await enrolled();
    const out = await svc.recover(token, recoveryCodes[0], { ip: '9.9.9.9' });
    expect(out.accessToken).toBeTruthy();
    expect(out.user).toMatchObject({ id: 'u1' });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_SUCCESS', actorId: 'u1' }),
    );
    const used = [...codes.values()].filter((c) => c.usedAt != null);
    expect(used).toHaveLength(1);
    await expect(svc.recover(token, recoveryCodes[0], {})).rejects.toThrow('Invalid recovery code');
  });

  it('codes are case- and hyphen-insensitive', async () => {
    const { svc, recoveryCodes, token } = await enrolled();
    const variant = recoveryCodes[1].toLowerCase().replace('-', '');
    const out = await svc.recover(token, variant, {});
    expect(out.accessToken).toBeTruthy();
  });

  it('wrong code is a bare 401 that reveals no remaining count', async () => {
    const { svc, token } = await enrolled();
    const err = await svc.recover(token, 'AAAA-BBBBBB', {}).catch((e) => e);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid recovery code');
    expect(err.message).not.toMatch(/remain|left|\d+ of \d+/i);
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TOTP_FAILED', result: 'FAILED' }),
    );
  });
});
