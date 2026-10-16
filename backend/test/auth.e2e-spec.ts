// STEP 3 HTTP acceptance (PRD §48): real HTTP through real guards with an
// in-memory Prisma double. DB-backed e2e runs once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { ThrottlerModule } from '@nestjs/throttler';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { RequirePermissions, Roles } from '../src/auth/decorators.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self', 'attendance:read:self', 'correction:create:self', 'leave:create:self'],
  SUPERVISOR: ['attendance:read:team', 'attendance:approve:team', 'report:read:team'],
  ADMIN: ['employee:read', 'device:revoke', 'audit:read'],
  SUPER_ADMIN: ['role:manage', 'security:manage'],
};
const RANK = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'];
const permsFor = (role: string) =>
  RANK.filter((r) => RANK.indexOf(r) <= RANK.indexOf(role)).flatMap((r) => PERMS[r] ?? []);

function makeFake() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  let seq = 0;
  return {
    users,
    sessions,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = where.email
          ? [...users.values()].find((x) => x.email === where.email)
          : users.get(where.id);
        if (!u) return null;
        if (include?.userRoles) return { ...u, userRoles: u.roles.map((r: string) => ({ role: { name: r } })) };
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
              rolePermissions: permsFor(r).map((key) => ({ permission: { key } })),
            },
          }));
        }
        return roles.map((r) => ({ role: { name: r } }));
      },
    },
    session: {
      create: async ({ data }: any) => {
        const s = { id: `s${++seq}`, createdAt: new Date(), revokedAt: null, ...data };
        sessions.set(s.id, s);
        return { ...s };
      },
      findUnique: async ({ where, include }: any) => {
        const s = where.id
          ? sessions.get(where.id) ?? null
          : ([...sessions.values()].find((x) => x.refreshTokenHash === where.refreshTokenHash) ?? null);
        if (!s) return null;
        if (include?.user) {
          const u = users.get(s.userId);
          return { ...s, user: { ...u, userRoles: u.roles.map((r: string) => ({ role: { name: r } })) } };
        }
        return { ...s };
      },
      findMany: async ({ where }: any) =>
        [...sessions.values()]
          .filter((s) => !where?.userId || s.userId === where.userId)
          .map((s) => ({ ...s })),
      update: async ({ where, data }: any) => {
        const s = sessions.get(where.id);
        Object.assign(s, data);
        return { ...s };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of sessions.values()) {
          if (where.userId && s.userId !== where.userId) continue;
          if (where.id && s.id !== where.id) continue;
          if (where.NOT?.id && s.id === where.NOT.id) continue;
          if (where.revokedAt === null && s.revokedAt) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
    },
    device: { findUnique: async () => null },
  };
}

@Controller('probe')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
class ProbeController {
  @Get('admin')
  @Roles('ADMIN')
  admin() {
    return { ok: true };
  }

  @Get('super')
  @Roles('SUPER_ADMIN')
  super() {
    return { ok: true };
  }

  @Get('rolemanage')
  @RequirePermissions('role:manage')
  roleManage() {
    return { ok: true };
  }
}

let app: INestApplication;
let fake: ReturnType<typeof makeFake>;

async function loginAs(email: string, password = 'Password123!') {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

beforeAll(async () => {
  fake = makeFake();
  const hash = await argon2.hash('Password123!');
  const seed = [
    ['u-emp', 'employee@rs.test', ['EMPLOYEE']],
    ['u-sup', 'supervisor@rs.test', ['SUPERVISOR']],
    ['u-adm', 'admin@rs.test', ['ADMIN']],
    ['u-super', 'superadmin@rs.test', ['SUPER_ADMIN']],
  ] as const;
  for (const [id, email, roles] of seed) {
    fake.users.set(id, {
      id, email, passwordHash: hash, isActive: true, failedLoginAttempts: 0, lockedUntil: null, roles: [...roles],
    });
  }

  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'e2e-secret', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [AuthController, ProbeController],
    providers: [
      AuthService,
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      { provide: PrismaService, useValue: fake },
      { provide: ConfigService, useValue: { get: (_k: string, d: unknown) => d } },
      { provide: AuditService, useValue: { log: async () => undefined } },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('auth flow over HTTP', () => {
  it('login -> me -> refresh rotation -> logout invalidates', async () => {
    const server = app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .send({ email: 'employee@rs.test', password: 'Password123!' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();

    const me = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.roles).toEqual(['EMPLOYEE']);

    const r1 = await request(server).post('/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(r1.status).toBe(200);
    const stale = await request(server).post('/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(stale.status).toBe(401);

    const out = await request(server)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${r1.body.accessToken}`);
    expect(out.status).toBe(200);
    const after = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${r1.body.accessToken}`);
    expect(after.status).toBe(401);
  });

  it('validation rejects bad input; unknown user is 401', async () => {
    const server = app.getHttpServer();
    const bad = await request(server).post('/auth/login').send({ email: 'not-an-email', password: 'x' });
    expect(bad.status).toBe(400);
    const unknown = await request(server)
      .post('/auth/login')
      .send({ email: 'ghost@rs.test', password: 'Password123!' });
    expect(unknown.status).toBe(401);
  });

  it('5 wrong passwords lock the account even for the right password', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      const r = await request(server)
        .post('/auth/login')
        .send({ email: 'supervisor@rs.test', password: 'Wrong123!' });
      expect(r.status).toBe(401);
    }
    const locked = await request(server)
      .post('/auth/login')
      .send({ email: 'supervisor@rs.test', password: 'Password123!' });
    expect(locked.status).toBe(403);
  });

  it('password change kills other sessions', async () => {
    const server = app.getHttpServer();
    const a = await request(server).post('/auth/login').send({ email: 'admin@rs.test', password: 'Password123!' });
    const b = await request(server).post('/auth/login').send({ email: 'admin@rs.test', password: 'Password123!' });
    const ch = await request(server)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${a.body.accessToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewStrong123!' });
    expect(ch.status).toBe(200);
    const killed = await request(server).get('/auth/me').set('Authorization', `Bearer ${b.body.accessToken}`);
    expect(killed.status).toBe(401);
    const alive = await request(server).get('/auth/me').set('Authorization', `Bearer ${a.body.accessToken}`);
    expect(alive.status).toBe(200);
  });
});

describe('RBAC acceptance over HTTP (PRD §48)', () => {
  it('EMPLOYEE cannot open ADMIN or SUPER_ADMIN APIs', async () => {
    const token = await loginAs('employee@rs.test');
    const server = app.getHttpServer();
    expect((await request(server).get('/probe/admin').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(server).get('/probe/super').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });

  it('SUPERVISOR cannot open SUPER_ADMIN API', async () => {
    // NOTE: supervisor@rs.test was locked by the lockout test above — use fresh admin-created session instead.
    const u = fake.users.get('u-sup');
    u.failedLoginAttempts = 0;
    u.lockedUntil = null;
    const token = await loginAs('supervisor@rs.test');
    const server = app.getHttpServer();
    expect((await request(server).get('/probe/super').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(server).get('/probe/admin').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });

  it('ADMIN cannot touch SUPER_ADMIN-only permission (role:manage)', async () => {
    const token = await loginAs('admin@rs.test', 'NewStrong123!');
    const server = app.getHttpServer();
    expect((await request(server).get('/probe/rolemanage').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(server).get('/probe/admin').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('SUPER_ADMIN passes everything; anonymous gets 401', async () => {
    const token = await loginAs('superadmin@rs.test');
    const server = app.getHttpServer();
    for (const p of ['admin', 'super', 'rolemanage']) {
      expect((await request(server).get(`/probe/${p}`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    }
    expect((await request(server).get('/probe/admin')).status).toBe(401);
  });
});

describe('JWT strictness over HTTP (STEP 22)', () => {
  it('tokens without issuer or with alg=none are rejected', async () => {
    const server = app.getHttpServer();
    const good = await loginAs('employee@rs.test');
    const [, payloadB64] = good.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    const signHS256 = (header: object, body: object) => {
      const h = Buffer.from(JSON.stringify(header)).toString('base64url');
      const b = Buffer.from(JSON.stringify(body)).toString('base64url');
      const sig = createHmac('sha256', 'e2e-secret').update(`${h}.${b}`).digest('base64url');
      return `${h}.${b}.${sig}`;
    };
    // same secret + sid, but issuer stripped
    const { iss: _dropped, ...noIss } = payload as Record<string, unknown>;
    const stripped = signHS256({ alg: 'HS256', typ: 'JWT' }, noIss);
    expect((await request(server).get('/auth/me').set('Authorization', `Bearer ${stripped}`)).status).toBe(401);

    // unsigned alg=none forgery
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const forged = `${noneHeader}.${payloadB64}.`;
    expect((await request(server).get('/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('blocks past the limit with 429', async () => {
    @Controller('rl')
    class RlController {
      @Get('ping')
      ping() {
        return { ok: true };
      }
    }
    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 2 }])],
      controllers: [RlController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    const a = mod.createNestApplication();
    await a.init();
    const s = a.getHttpServer();
    expect((await request(s).get('/rl/ping')).status).toBe(200);
    expect((await request(s).get('/rl/ping')).status).toBe(200);
    expect((await request(s).get('/rl/ping')).status).toBe(429);
    await a.close();
  });
});

describe('injection attempts (PRD §69)', () => {
  it('SQL strings in login are inert (401, no crash, no leak)', async () => {
    const server = app.getHttpServer();
    for (const payload of [
      { email: `' OR '1'='1`, password: 'x' },
      { email: 'employee@rs.test', password: `' OR '1'='1' --` },
      { email: `a@b.c'; DROP TABLE users; --`, password: 'x' },
    ]) {
      const r = await request(server).post('/auth/login').send(payload);
      expect([400, 401, 403]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain('passwordHash');
      expect(JSON.stringify(r.body)).not.toContain('SELECT');
    }
  });
});
