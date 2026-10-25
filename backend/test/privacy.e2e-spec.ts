// STEP 21 HTTP acceptance (PRD §66): consent lifecycle, export redaction,
// erasure, retention sweep, SUPER_ADMIN-only retention.
// DB-backed e2e once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrivacyController } from '../src/privacy/privacy.controller.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  ADMIN: ['employee:read'],
  SUPER_ADMIN: ['system:manage', 'role:manage'],
};

function makeFake() {
  const users = new Map<string, any>([
    [
      'u-emp',
      { id: 'u-emp', email: 'emp@rs.test', passwordHash: 'x', isActive: true },
    ],
    [
      'u-sup',
      {
        id: 'u-sup',
        email: 'super@rs.test',
        passwordHash: 'x',
        isActive: true,
      },
    ],
  ]);
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [
    { userId: 'u-emp', role: 'EMPLOYEE' },
    { userId: 'u-sup', role: 'SUPER_ADMIN' },
  ];
  const employees = new Map<string, any>([
    [
      'e-emp',
      {
        id: 'e-emp',
        userId: 'u-emp',
        employeeNo: 'EMP-001',
        name: 'Siti',
        status: 'ACTIVE',
        department: { id: 'd1', name: 'IGD' },
        user: { id: 'u-emp', email: 'emp@rs.test', isActive: true },
      },
    ],
    [
      'e-old',
      {
        id: 'e-old',
        userId: 'u-gone',
        employeeNo: 'EMP-099',
        name: 'Keluar',
        status: 'INACTIVE',
        department: null,
        user: null,
      },
    ],
  ]);
  const consents = new Map<string, any>();
  const devices = new Map<string, any>([
    [
      'd1',
      {
        id: 'd1',
        employeeId: 'e-emp',
        devicePublicKey: 'se rahasia',
        platform: 'ANDROID',
      },
    ],
  ]);
  const attendances = new Map<string, any>();
  const faces = new Map<string, any>([
    [
      'e-old',
      {
        id: 'f-old',
        employeeId: 'e-old',
        templateCipher: new Uint8Array([9]),
        updatedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    ],
  ]);
  const idemKeys = new Map<string, any>();
  const liveSessions = new Map<string, any>([
    [
      's-old',
      {
        id: 's-old',
        revokedAt: new Date('2020-01-01T00:00:00.000Z'),
        expiresAt: new Date('2020-02-01T00:00:00.000Z'),
      },
    ],
  ]);
  const audits: any[] = [];
  let seq = 100;

  return {
    users,
    sessions: liveSessions,
    employees,
    consents,
    devices,
    attendances,
    faces,
    audits,
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
    employee: {
      findUnique: async ({ where, include }: any) => {
        let e = null;
        if (where.id) e = employees.get(where.id) ?? null;
        else if ('userId' in where)
          e =
            [...employees.values()].find((x) => x.userId === where.userId) ??
            null;
        if (!e) return null;
        return include ? { ...e } : { ...e };
      },
    },
    consent: {
      findUnique: async ({ where }: any) =>
        consents.get(
          `${where.employeeId_purpose.employeeId}:${where.employeeId_purpose.purpose}`,
        ) ?? null,
      findMany: async ({ where }: any) =>
        [...consents.values()].filter(
          (c) => !where?.employeeId || c.employeeId === where.employeeId,
        ),
      create: async ({ data }: any) => {
        const c = {
          id: `c${++seq}`,
          grantedAt: new Date(),
          revokedAt: null,
          ...data,
        };
        consents.set(`${c.employeeId}:${c.purpose}`, c);
        return { ...c };
      },
      update: async ({ where, data }: any) => {
        const c = [...consents.values()].find((x) => x.id === where.id);
        Object.assign(c, data);
        return { ...c };
      },
    },
    device: {
      findMany: async ({ where }: any) =>
        [...devices.values()].filter(
          (d) => !where?.employeeId || d.employeeId === where.employeeId,
        ),
    },
    attendance: {
      findMany: async () => [],
    },
    faceTemplate: {
      findUnique: async ({ where }: any) => faces.get(where.employeeId) ?? null,
      findMany: async ({ where }: any) => {
        let rows = [...faces.values()];
        if (where?.employee?.status) {
          rows = rows.filter(
            (f) =>
              employees.get(f.employeeId)?.status === where.employee.status,
          );
        }
        if (where?.updatedAt?.lt) {
          rows = rows.filter((f) => f.updatedAt < new Date(where.updatedAt.lt));
        }
        return rows.map((f) => ({ ...f }));
      },
      delete: async ({ where }: any) => {
        const hit = [...faces.entries()].find(([, f]) => f.id === where.id);
        if (hit) faces.delete(hit[0]);
        return { id: where.id };
      },
      deleteMany: async ({ where }: any) => {
        let n = 0;
        for (const [k, f] of faces) {
          if (where?.employeeId && f.employeeId !== where.employeeId) continue;
          faces.delete(k);
          n++;
        }
        return { count: n };
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
        liveSessions.set(s.id, s);
        return { ...s };
      },
      findUnique: async ({ where }: any) => liveSessions.get(where.id) ?? null,
      deleteMany: async ({ where }: any) => {
        let n = 0;
        for (const [k, s] of liveSessions) {
          const matchOr = (where?.OR ?? []).some((c: any) => {
            if (c.revokedAt?.lt)
              return s.revokedAt && s.revokedAt < new Date(c.revokedAt.lt);
            if (c.expiresAt?.lt)
              return s.expiresAt && s.expiresAt < new Date(c.expiresAt.lt);
            return false;
          });
          if (matchOr) {
            liveSessions.delete(k);
            n++;
          }
        }
        return { count: n };
      },
    },
    idempotencyKey: {
      deleteMany: async () => {
        const n = idemKeys.size;
        idemKeys.clear();
        return { count: n };
      },
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
        secret: 'e2e-prv',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [PrivacyController],
    providers: [
      PrivacyService,
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
      {
        provide: AuditService,
        useValue: { log: async (e: unknown) => void fake.audits.push(e) },
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

describe('privacy over HTTP (PRD §66)', () => {
  it('notice + consent grant/revoke + own list', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    const auth = { Authorization: `Bearer ${emp}` };

    const notice = await request(server).get('/privacy/notice').set(auth);
    expect(notice.status).toBe(200);
    expect(notice.body.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const grant = await request(server)
      .post('/privacy/consent')
      .set(auth)
      .send({ purpose: 'BIOMETRIC_ATTENDANCE', granted: true });
    expect(grant.status).toBe(200);
    expect(grant.body).toMatchObject({ granted: true });

    const mine = await request(server).get('/privacy/consents/me').set(auth);
    expect(mine.body).toHaveLength(1);

    const revoke = await request(server)
      .post('/privacy/consent')
      .set(auth)
      .send({ purpose: 'BIOMETRIC_ATTENDANCE', granted: false });
    expect(revoke.body.granted).toBe(false);

    const actions = fake.audits.map((a: { action: string }) => a.action);
    expect(actions).toContain('CONSENT_GRANTED');
    expect(actions).toContain('CONSENT_REVOKED');
  });

  it('export redacts secrets; retention is SUPER_ADMIN-only and purges', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    const sup = await tokenFor('u-sup', ['SUPER_ADMIN']);
    const auth = { Authorization: `Bearer ${emp}` };

    const exp = await request(server).get('/privacy/export/me').set(auth);
    expect(exp.status).toBe(200);
    expect(exp.body.devices[0].devicePublicKey).toBe('[redacted]');
    expect(exp.body).not.toHaveProperty('templateCipher');
    expect(exp.body.faceRegistered).toBe(false);

    expect(
      (await request(server).post('/privacy/retention/run').set(auth)).status,
    ).toBe(403);

    const run = await request(server)
      .post('/privacy/retention/run')
      .set({ Authorization: `Bearer ${sup}` });
    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({ sessions: 1, faceTemplates: 1 });
    const actions = fake.audits.map((a: { action: string }) => a.action);
    expect(actions).toContain('RETENTION_RUN');
  });
});
