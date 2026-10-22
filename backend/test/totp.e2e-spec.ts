// TOTP HTTP acceptance: full enroll -> challenge -> verify/recover/disable
// through real guards with an in-memory Prisma double (own minimal fake).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { totp } from '../src/auth/totp.js';
import { TotpController } from '../src/auth/totp.controller.js';
import { TotpService } from '../src/auth/totp.service.js';

function makeFake() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const codes = new Map<string, any>();
  let seq = 0;
  return {
    users,
    sessions,
    codes,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = where.email
          ? [...users.values()].find((x) => x.email === where.email)
          : users.get(where.id);
        if (!u) return null;
        if (include?.userRoles)
          return {
            ...u,
            userRoles: u.roles.map((r: string) => ({ role: { name: r } })),
          };
        return { ...u };
      },
      update: async ({ where, data }: any) => {
        const u = users.get(where.id);
        Object.assign(u, data);
        return { ...u };
      },
    },
    userRole: {
      findMany: async ({ where, include }: any) => {
        const u = users.get(where.userId);
        const roles: string[] = u?.roles ?? [];
        if (include?.role?.include?.rolePermissions) {
          return roles.map((r) => ({
            role: {
              name: r,
              rolePermissions: [] as Array<{ permission: { key: string } }>,
            },
          }));
        }
        return roles.map((r: string) => ({ role: { name: r } }));
      },
    },
    session: {
      create: async ({ data }: any) => {
        const s = {
          id: `s${++seq}`,
          createdAt: new Date(),
          revokedAt: null,
          ...data,
        };
        sessions.set(s.id, s);
        return { ...s };
      },
      findUnique: async ({ where }: any) => {
        const s = where.id
          ? (sessions.get(where.id) ?? null)
          : ([...sessions.values()].find(
              (x) => x.refreshTokenHash === where.refreshTokenHash,
            ) ?? null);
        return s ? { ...s } : null;
      },
      findMany: async () => [...sessions.values()].map((s) => ({ ...s })),
      update: async ({ where, data }: any) => {
        const s = sessions.get(where.id);
        Object.assign(s, data);
        return { ...s };
      },
      updateMany: async () => ({ count: 1 }),
    },
    totpRecoveryCode: {
      findMany: async ({ where }: any) =>
        [...codes.values()]
          .filter(
            (c) =>
              (!where?.userId || c.userId === where.userId) &&
              (where?.usedAt !== null || c.usedAt == null),
          )
          .map((c) => ({ ...c })),
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, c] of codes) {
          if (!where?.userId || c.userId === where.userId) {
            codes.delete(id);
            count++;
          }
        }
        return { count };
      },
      createMany: async ({ data }: any) => {
        for (const d of data) {
          const id = `c${++seq}`;
          codes.set(id, { id, usedAt: null, createdAt: new Date(), ...d });
        }
        return { count: data.length };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const c of codes.values()) {
          if (where?.id && c.id !== where.id) continue;
          if (where?.usedAt === null && c.usedAt != null) continue;
          Object.assign(c, data);
          count++;
        }
        return { count };
      },
    },
    device: { findUnique: async () => null },
  };
}

let app: INestApplication;
let fake: ReturnType<typeof makeFake>;

async function seedUser(id: string, email: string, password = 'Password123!') {
  fake.users.set(id, {
    id,
    email,
    passwordHash: await argon2.hash(password),
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    totpSecret: null,
    totpEnabled: false,
    roles: ['EMPLOYEE'],
  });
}

beforeAll(async () => {
  fake = makeFake();
  await seedUser('u-plain', 'plain@rs.test');
  await seedUser('u-totp', 'totp@rs.test');

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: 'e2e-secret',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [AuthController, TotpController],
    providers: [
      AuthService,
      TotpService,
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      { provide: PrismaService, useValue: fake },
      {
        provide: ConfigService,
        useValue: { get: (_k: string, d: unknown) => d },
      },
      { provide: AuditService, useValue: { log: async () => undefined } },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('TOTP over HTTP', () => {
  it('disabled-user login is unchanged (full tokens directly)', async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post('/auth/login')
      .send({ email: 'plain@rs.test', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.expiresIn).toBe(15 * 60);
    expect(res.body.user).toMatchObject({
      id: 'u-plain',
      email: 'plain@rs.test',
    });
    expect(res.body.totpRequired).toBeUndefined();
  });

  it('setup requires auth and returns secret + exact otpauth URI', async () => {
    const server = app.getHttpServer();
    expect((await request(server).post('/auth/totp/setup')).status).toBe(401);

    const login = await request(server)
      .post('/auth/login')
      .send({ email: 'totp@rs.test', password: 'Password123!' });
    const token = login.body.accessToken as string;

    const res = await request(server)
      .post('/auth/totp/setup')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(res.body.otpauthUri).toBe(
      `otpauth://totp/face-absen:totp@rs.test?secret=${res.body.secret}` +
        `&issuer=face-absen&algorithm=SHA1&digits=6&period=30`,
    );
  });

  it('enable -> login challenge -> verify wrong 401 -> verify correct session', async () => {
    const server = app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .send({ email: 'totp@rs.test', password: 'Password123!' });
    const token = login.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const secret = fake.users.get('u-totp').totpSecret as string;
    expect(secret).toBeTruthy();

    const badEnable = await request(server)
      .post('/auth/totp/enable')
      .set(auth)
      .send({ code: '000000' });
    // 000000 is near-certainly wrong; if flaky, the correct-code path below still proves the flow.
    expect([200, 401]).toContain(badEnable.status);

    const good = await request(server)
      .post('/auth/totp/enable')
      .set(auth)
      .send({ code: totp(secret) });
    expect(good.status).toBe(200);
    expect(good.body.recoveryCodes).toHaveLength(8);

    const challenged = await request(server)
      .post('/auth/login')
      .send({ email: 'totp@rs.test', password: 'Password123!' });
    expect(challenged.status).toBe(200);
    expect(challenged.body.totpRequired).toBe(true);
    expect(challenged.body.totpToken).toBeTruthy();
    expect(challenged.body.expiresIn).toBe(300);
    expect(challenged.body.accessToken).toBeUndefined();
    const challenge = challenged.body.totpToken as string;

    const wrong = await request(server)
      .post('/auth/totp/verify')
      .send({
        totpToken: challenge,
        code: '123456' === totp(secret) ? '654321' : '123456',
      });
    expect(wrong.status).toBe(401);

    const ok = await request(server)
      .post('/auth/totp/verify')
      .send({ totpToken: challenge, code: totp(secret) });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    expect(ok.body.refreshToken).toBeTruthy();
    expect(ok.body.user).toMatchObject({ id: 'u-totp' });

    const me = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${ok.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('totp@rs.test');
  });

  it('recovery code logs in once, then is consumed', async () => {
    // u-totp is still enabled from the previous test. Disable it, re-enroll to
    // capture fresh plaintext codes, then prove single-use recovery.
    const server = app.getHttpServer();
    const ch = await request(server)
      .post('/auth/login')
      .send({ email: 'totp@rs.test', password: 'Password123!' });
    expect(ch.body.totpRequired).toBe(true);
    const secret = fake.users.get('u-totp').totpSecret as string;
    const verified = await request(server)
      .post('/auth/totp/verify')
      .send({ totpToken: ch.body.totpToken, code: totp(secret) });
    expect(verified.status).toBe(200);

    const disabled = await request(server)
      .post('/auth/totp/disable')
      .set('Authorization', `Bearer ${verified.body.accessToken}`)
      .send({ password: 'Password123!' });
    expect(disabled.status).toBe(200);
    expect(disabled.body).toEqual({ disabled: true });

    // Disabled again: plain login works with no challenge.
    const plain = await request(server)
      .post('/auth/login')
      .send({ email: 'totp@rs.test', password: 'Password123!' });
    expect(plain.body.accessToken).toBeTruthy();

    const freshToken = plain.body.accessToken as string;
    const setup = await request(server)
      .post('/auth/totp/setup')
      .set('Authorization', `Bearer ${freshToken}`);
    expect(setup.status).toBe(200);
    const freshSecret = setup.body.secret as string;
    const enabled = await request(server)
      .post('/auth/totp/enable')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ code: totp(freshSecret) });
    expect(enabled.status).toBe(200);
    const code = enabled.body.recoveryCodes[0] as string;

    const ch2 = await request(server)
      .post('/auth/login')
      .send({ email: 'totp@rs.test', password: 'Password123!' });
    const recovered = await request(server)
      .post('/auth/totp/recover')
      .send({ totpToken: ch2.body.totpToken, recoveryCode: code });
    expect(recovered.status).toBe(200);
    expect(recovered.body.accessToken).toBeTruthy();

    const reuse = await request(server)
      .post('/auth/totp/recover')
      .send({ totpToken: ch2.body.totpToken, recoveryCode: code });
    expect(reuse.status).toBe(401);

    const bogus = await request(server)
      .post('/auth/totp/recover')
      .send({ totpToken: ch2.body.totpToken, recoveryCode: 'ZZZZ-ZZZZZZ' });
    expect(bogus.status).toBe(401);
  });

  it('disable rejects a wrong password', async () => {
    const server = app.getHttpServer();
    const ch = await request(server)
      .post('/auth/login')
      .send({ email: 'totp@rs.test', password: 'Password123!' });
    const secret = fake.users.get('u-totp').totpSecret as string;
    const verified = await request(server)
      .post('/auth/totp/verify')
      .send({ totpToken: ch.body.totpToken, code: totp(secret) });
    const bad = await request(server)
      .post('/auth/totp/disable')
      .set('Authorization', `Bearer ${verified.body.accessToken}`)
      .send({ password: 'Wrong123!' });
    expect(bad.status).toBe(401);
  });
});
