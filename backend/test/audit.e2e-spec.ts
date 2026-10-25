// STEP 19 HTTP acceptance (PRD §64): audit viewer is read-only and RBAC-gated.
// DB-backed e2e once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditController } from '../src/audit/audit.controller.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  ADMIN: ['audit:read', 'employee:read'],
  SUPER_ADMIN: ['audit:read'],
};

function makeFake() {
  const users = new Map<string, any>([
    [
      'u-adm',
      {
        id: 'u-adm',
        email: 'admin@rs.test',
        passwordHash: 'x',
        isActive: true,
      },
    ],
    [
      'u-emp',
      { id: 'u-emp', email: 'emp@rs.test', passwordHash: 'x', isActive: true },
    ],
    [
      'u-sa',
      { id: 'u-sa', email: 'sa@rs.test', passwordHash: 'x', isActive: true },
    ],
  ]);
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [
    { userId: 'u-adm', role: 'ADMIN' },
    { userId: 'u-emp', role: 'EMPLOYEE' },
    { userId: 'u-sa', role: 'SUPER_ADMIN' },
  ];
  const logs = [
    {
      id: 'l1',
      actorId: 'u-emp',
      action: 'LOGIN_FAILED',
      targetType: null,
      targetId: null,
      timestamp: new Date('2026-10-05T06:00:00.000Z'),
      ipAddress: '1.1.1.1',
      deviceId: null,
      result: 'FAILED',
      actor: { id: 'u-emp', email: 'emp@rs.test' },
    },
    {
      id: 'l2',
      actorId: 'u-emp',
      action: 'LOGIN_SUCCESS',
      targetType: null,
      targetId: null,
      timestamp: new Date('2026-10-05T07:00:00.000Z'),
      ipAddress: '1.1.1.1',
      deviceId: null,
      result: 'SUCCESS',
      actor: { id: 'u-emp', email: 'emp@rs.test' },
    },
    {
      id: 'l3',
      actorId: 'u-adm',
      action: 'DEVICE_REVOKED',
      targetType: 'device',
      targetId: 'd9',
      timestamp: new Date('2026-10-05T08:00:00.000Z'),
      ipAddress: null,
      deviceId: null,
      result: 'SUCCESS',
      actor: { id: 'u-adm', email: 'admin@rs.test' },
    },
  ];
  let seq = 100;

  const match = (l: any, where: any): boolean => {
    for (const c of where?.AND ?? []) {
      if (c.action && typeof c.action === 'string' && l.action !== c.action)
        return false;
      if (c.action?.in && !c.action.in.includes(l.action)) return false;
      if (c.actorId && l.actorId !== c.actorId) return false;
      if (c.result && l.result !== c.result) return false;
      if (c.targetType && l.targetType !== c.targetType) return false;
      if (c.targetId && l.targetId !== c.targetId) return false;
      if (c.timestamp?.gte && l.timestamp < new Date(c.timestamp.gte))
        return false;
      if (c.timestamp?.lte && l.timestamp > new Date(c.timestamp.lte))
        return false;
      if (c.actor?.email) {
        const q = String(c.actor.email.contains ?? '').toLowerCase();
        if (
          !String(l.actor?.email ?? '')
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
    }
    return true;
  };

  return {
    users,
    sessions,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = users.get(where.id) ?? null;
        if (!u) return null;
        return include?.userRoles
          ? {
              ...u,
              userRoles: userRoles
                .filter((r) => r.userId === u.id)
                .map((r) => ({ role: { name: r.role } })),
            }
          : { ...u };
      },
    },
    userRole: {
      findMany: async ({ where, include }: any) => {
        const roles = userRoles
          .filter((r) => r.userId === where.userId)
          .map((r) => r.role);
        if (include?.role?.include?.rolePermissions) {
          return roles.map((r) => ({
            role: {
              name: r,
              rolePermissions: (ROLE_PERMS[r] ?? []).map((key) => ({
                permission: { key },
              })),
            },
          }));
        }
        return roles.map((r) => ({ role: { name: r } }));
      },
    },
    auditLog: {
      create: async ({ data }: any) => ({
        id: `l${++seq}`,
        timestamp: new Date(),
        ...data,
      }),
      count: async ({ where }: any) =>
        logs.filter((l) => match(l, where)).length,
      findMany: async ({ where, skip = 0, take, include }: any) => {
        void include;
        let rows = logs.filter((l) => match(l, where));
        rows = rows
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(skip, take === undefined ? undefined : skip + take);
        return rows.map((l) => ({ ...l }));
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
      findUnique: async ({ where }: any) => sessions.get(where.id) ?? null,
    },
  };
}

let app: INestApplication;
let fake: ReturnType<typeof makeFake>;
let jwt: JwtService;

async function tokenFor(userId: string, roles: string[]) {
  const s = await fake.session.create({
    data: {
      userId,
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  return jwt.signAsync({
    sub: userId,
    email: `${userId}@x.test`,
    roles,
    sid: s.id,
  });
}

beforeAll(async () => {
  fake = makeFake();

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: 'e2e-aud',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [AuditController],
    providers: [
      AuditService,
      AuthService,
      { provide: EmailVerificationService, useValue: { issue: async () => undefined, verify: async () => ({ userId: 'u1' }) } },
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      { provide: PrismaService, useValue: fake },
      {
        provide: ConfigService,
        useValue: { get: (_k: string, d: unknown) => d },
      },
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
  jwt = app.get(JwtService);
});

afterAll(async () => {
  await app?.close();
});

describe('audit viewer over HTTP (PRD §64)', () => {
  it('super-admin filters + actions catalog + security preset', async () => {
    const server = app.getHttpServer();
    const sa = await tokenFor('u-sa', ['SUPER_ADMIN']);

    const all = await request(server)
      .get('/audit')
      .set('Authorization', `Bearer ${sa}`);
    expect(all.status).toBe(200);
    expect(all.body.pagination.totalItems).toBe(3);

    const failed = await request(server)
      .get('/audit?action=LOGIN_FAILED')
      .set('Authorization', `Bearer ${sa}`);
    expect(failed.body.data).toHaveLength(1);
    expect(failed.body.data[0].id).toBe('l1');

    const byActor = await request(server)
      .get('/audit?actorEmail=admin@rs')
      .set('Authorization', `Bearer ${sa}`);
    expect(byActor.body.data).toHaveLength(1);
    expect(byActor.body.data[0].id).toBe('l3');

    const sec = await request(server)
      .get('/audit?security=true')
      .set('Authorization', `Bearer ${sa}`);
    expect(sec.body.pagination.totalItems).toBe(2); // LOGIN_FAILED + DEVICE_REVOKED

    const actions = await request(server)
      .get('/audit/actions')
      .set('Authorization', `Bearer ${sa}`);
    expect(actions.body).toEqual(
      expect.arrayContaining(['LOGIN_FAILED', 'DEVICE_REVOKED']),
    );
  });

  it('admin and employee denied; anon denied; log is read-only (no write routes)', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    const adm = await tokenFor('u-adm', ['ADMIN']);

    expect(
      (
        await request(server)
          .get('/audit')
          .set('Authorization', `Bearer ${emp}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .get('/audit')
          .set('Authorization', `Bearer ${adm}`)
      ).status,
    ).toBe(403);
    expect((await request(server).get('/audit')).status).toBe(401);
    expect(
      (
        await request(server)
          .post('/audit')
          .set('Authorization', `Bearer ${emp}`)
          .send({})
      ).status,
    ).toBe(404);
    expect(
      (
        await request(server)
          .patch('/audit/l1')
          .set('Authorization', `Bearer ${emp}`)
          .send({})
      ).status,
    ).toBe(404);
    expect(
      (
        await request(server)
          .delete('/audit/l1')
          .set('Authorization', `Bearer ${emp}`)
      ).status,
    ).toBe(404);
  });
});
