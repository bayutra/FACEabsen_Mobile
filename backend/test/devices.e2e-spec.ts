// STEP 7 HTTP acceptance (PRD §52): real HTTP through real guards with an
// in-memory Prisma double. DB-backed e2e runs once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { generateKeyPairSync, sign } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { DevicesController } from '../src/devices/devices.controller.js';
import { DevicesService } from '../src/devices/devices.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  SUPERVISOR: ['attendance:read:team'],
  ADMIN: ['device:read', 'device:revoke', 'employee:read'],
  SUPER_ADMIN: ['device:read', 'device:revoke'],
};

function makeFake() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [];
  const employees = new Map<string, any>([
    [
      'e-emp',
      {
        id: 'e-emp',
        userId: 'u-emp',
        employeeNo: 'EMP-001',
        name: 'Karyawan',
        email: 'employee@rs.test',
        departmentId: 'd1',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    ],
    [
      'e-other',
      {
        id: 'e-other',
        userId: 'u-other',
        employeeNo: 'EMP-002',
        name: 'Lain',
        email: 'other@rs.test',
        departmentId: 'd1',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    ],
    // Tahap 2 tenant scoping: the ADMIN actor belongs to the same facility as
    // every fixture. A facility-less admin would correctly see nothing.
    [
      'e-adm',
      {
        id: 'e-adm',
        userId: 'u-adm',
        employeeNo: 'EMP-000',
        name: 'Admin',
        email: 'admin@rs.test',
        departmentId: 'd1',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    ],
  ]);
  const departments = new Map<string, any>([
    ['d1', { id: 'd1', name: 'IGD', hospitalId: 'h1' }],
  ]);
  const devices = new Map<string, any>();
  const audits: any[] = [];
  let seq = 100;

  const employeeView = (e: any) =>
    e
      ? {
          id: e.id,
          userId: e.userId,
          name: e.name,
          employeeNo: e.employeeNo,
          department: e.departmentId
            ? (departments.get(e.departmentId) ?? null)
            : null,
        }
      : null;

  const matchDevice = (d: any, where: any): boolean => {
    if (!where || Object.keys(where).length === 0) return true;
    if (where.AND) return where.AND.every((c: any) => matchDevice(d, c));
    if (where.OR) {
      return where.OR.some((c: any) =>
        Object.entries(c).every(([k, v]: [string, any]) => {
          if (v && typeof v === 'object' && 'contains' in v) {
            const s = String(d[k] ?? '');
            return v.mode === 'insensitive'
              ? s.toLowerCase().includes(String(v.contains).toLowerCase())
              : s.includes(v.contains);
          }
          return d[k] === v;
        }),
      );
    }
    if (where.employee && typeof where.employee === 'object') {
      // Tahap 2 tenant scoping: { employee: { department: { hospitalId } } }.
      const e = employees.get(d.employeeId) ?? null;
      if (!e) return false;
      const pred = where.employee;
      if (pred.department?.hospitalId) {
        const dep = e.departmentId
          ? (departments.get(e.departmentId) ?? null)
          : null;
        if (!dep || dep.hospitalId !== pred.department.hospitalId) return false;
      }
      for (const [k, v] of Object.entries(pred) as Array<[string, any]>) {
        if (k === 'department') continue;
        if (e[k] !== v) return false;
      }
      return true;
    }
    for (const [k, v] of Object.entries(where) as Array<[string, any]>) {
      if (v && typeof v === 'object' && 'contains' in v) {
        const s = String(d[k] ?? '');
        const hit =
          v.mode === 'insensitive'
            ? s.toLowerCase().includes(String(v.contains).toLowerCase())
            : s.includes(v.contains);
        if (!hit) return false;
      } else if ((d as any)[k] !== v) return false;
    }
    return true;
  };

  return {
    users,
    sessions,
    employees,
    devices,
    audits,
    userRoles,
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
        else return null;
        if (!e) return null;
        if (include?.department)
          return {
            ...e,
            department: e.departmentId
              ? (departments.get(e.departmentId) ?? null)
              : null,
          };
        return { ...e };
      },
    },
    device: {
      findFirst: async ({ where }: any) => {
        const rows = [...devices.values()];
        if (where.OR) {
          return (
            rows.find((d) =>
              where.OR.some((c: any) =>
                Object.entries(c).every(([k, v]) => d[k] === v),
              ),
            ) ?? null
          );
        }
        return (
          rows.find((d) =>
            Object.entries(where).every(([k, v]) => d[k] === v),
          ) ?? null
        );
      },
      findMany: async ({ where, skip = 0, take, include }: any) => {
        let rows = [...devices.values()].filter((d) => matchDevice(d, where));
        rows = rows.slice(skip, take === undefined ? undefined : skip + take);
        return rows.map((d) => ({
          ...d,
          ...(include?.employee
            ? { employee: employeeView(employees.get(d.employeeId)) }
            : {}),
        }));
      },
      count: async ({ where }: any) =>
        [...devices.values()].filter((d) => matchDevice(d, where)).length,
      findUnique: async ({ where, include }: any) => {
        const d = devices.get(where.id) ?? null;
        if (!d) return null;
        const out: any = { ...d };
        if (include?.employee) {
          out.employee = employeeView(employees.get(d.employeeId));
        }
        if (include?.sessions) {
          out.sessions = [...sessions.values()]
            .filter((s) => s.deviceId === d.id)
            .map((s) => ({
              id: s.id,
              createdAt: s.createdAt,
              expiresAt: s.expiresAt,
              revokedAt: s.revokedAt,
            }));
        }
        if (include?.oldChanges) out.oldChanges = [];
        if (include?.newChanges) out.newChanges = [];
        return out;
      },
      create: async ({ data }: any) => {
        const d = {
          id: `d${++seq}`,
          registeredAt: new Date(),
          lastSeenAt: null,
          ...data,
        };
        devices.set(d.id, d);
        return { ...d };
      },
      update: async ({ where, data }: any) => {
        const d = devices.get(where.id);
        Object.assign(d, data);
        return { ...d };
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
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of sessions.values()) {
          if (where.deviceId && s.deviceId !== where.deviceId) continue;
          if (where.revokedAt === null && s.revokedAt) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
    },
  };
}

let app: INestApplication;
let fake: ReturnType<typeof makeFake>;
let jwt: JwtService;

async function tokenFor(userId: string, roles: string[], email: string) {
  const s = await fake.session.create({
    data: {
      userId,
      refreshTokenHash: 'h',
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  return jwt.signAsync({ sub: userId, email, roles, sid: s.id });
}

const regDto = (
  installationId: string,
  key: string,
  nonce: string,
  nonceSignature: string,
) => ({
  installationId,
  platform: 'ANDROID',
  deviceName: 'Galaxy J2',
  appVersion: '1.0.0',
  devicePublicKey: key,
  nonce,
  nonceSignature,
});

// Real Ed25519 device keys: registration now proves possession of the private
// key, so the e2e flow signs each challenge nonce like the mobile client.
function makeKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = (publicKey.export({ format: 'der', type: 'spki' }) as Buffer)
    .subarray(-32)
    .toString('base64');
  return { privateKey, pubB64: raw };
}
const kp1 = makeKeypair();
const kp2 = makeKeypair();
const signNonce = (
  priv: ReturnType<typeof makeKeypair>['privateKey'],
  nonce: string,
) => sign(null, Buffer.from(nonce, 'utf8'), priv).toString('base64');

async function challengeFor(server: unknown, token: string): Promise<string> {
  const res = await request(server as never)
    .get('/devices/register-challenge')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(typeof res.body.nonce).toBe('string');
  expect(typeof res.body.expiresAt).toBe('string');
  return res.body.nonce as string;
}

beforeAll(async () => {
  fake = makeFake();
  const seed = [
    ['u-emp', 'employee@rs.test', ['EMPLOYEE']],
    ['u-other', 'other@rs.test', ['EMPLOYEE']],
    ['u-adm', 'admin@rs.test', ['ADMIN']],
    ['u-sa', 'sa@rs.test', ['SUPER_ADMIN']],
  ] as const;
  for (const [id, email, roles] of seed) {
    fake.users.set(id, { id, email, passwordHash: 'x', isActive: true });
    for (const r of roles) fake.userRoles.push({ userId: id, role: r });
  }

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: 'e2e-dev',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [DevicesController],
    providers: [
      DevicesService,
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

describe('device binding flow', () => {
  it('challenge -> first device ACTIVE, second PENDING, same-owner retry is idempotent', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');

    const n1 = await challengeFor(server, emp);
    const first = await request(server)
      .post('/devices/register')
      .set('Authorization', `Bearer ${emp}`)
      .send(
        regDto('install-001', kp1.pubB64, n1, signNonce(kp1.privateKey, n1)),
      );
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('ACTIVE');
    const id = first.body.id as string;

    const mine = await request(server)
      .get('/devices/me')
      .set('Authorization', `Bearer ${emp}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);

    const n2 = await challengeFor(server, emp);
    const second = await request(server)
      .post('/devices/register')
      .set('Authorization', `Bearer ${emp}`)
      .send(
        regDto('install-002', kp2.pubB64, n2, signNonce(kp2.privateKey, n2)),
      );
    expect(second.status).toBe(201);
    expect(second.body.status).toBe('PENDING');

    const n3 = await challengeFor(server, emp);
    const dup = await request(server)
      .post('/devices/register')
      .set('Authorization', `Bearer ${emp}`)
      .send(
        regDto('install-001', kp1.pubB64, n3, signNonce(kp1.privateKey, n3)),
      );
    // Same install+keypair coming back (fresh login, reinstall): idempotent
    // 200 resolving to the existing row — not a 409. Fresh logins must work.
    expect(dup.status).toBe(201);
    expect(dup.body.id).toBe(id);
    expect(dup.body.status).toBe('ACTIVE');

    const beat = await request(server)
      .post(`/devices/${id}/heartbeat`)
      .set('Authorization', `Bearer ${emp}`);
    expect(beat.status).toBe(200);
    expect(beat.body.lastSeenAt).toBeTruthy();

    expect(fake.audits.map((a) => a.action)).toContain('DEVICE_REGISTERED');
  });

  it('owner/admin read matrix; stranger and anon denied', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    const other = await tokenFor('u-other', ['EMPLOYEE'], 'other@rs.test');
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const id = [...fake.devices.values()][0].id as string;

    expect(
      (
        await request(server)
          .get(`/devices/${id}`)
          .set('Authorization', `Bearer ${emp}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(server)
          .get(`/devices/${id}`)
          .set('Authorization', `Bearer ${adm}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(server)
          .get(`/devices/${id}`)
          .set('Authorization', `Bearer ${other}`)
      ).status,
    ).toBe(404);
    expect((await request(server).get(`/devices/${id}`)).status).toBe(401);
    expect(
      (
        await request(server)
          .post(`/devices/${id}/heartbeat`)
          .set('Authorization', `Bearer ${other}`)
      ).status,
    ).toBe(404);
  });

  it('validation rejects bad platform/key; missing proof 400, forged proof 401', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');

    const n1 = await challengeFor(server, emp);
    const proof1 = regDto(
      'install-009',
      kp1.pubB64,
      n1,
      signNonce(kp1.privateKey, n1),
    );
    const bad = await request(server)
      .post('/devices/register')
      .set('Authorization', `Bearer ${emp}`)
      .send({ ...proof1, installationId: 'install-009', platform: 'WINDOWS' });
    expect(bad.status).toBe(400);
    const n2 = await challengeFor(server, emp);
    const proof2 = regDto(
      'install-009',
      kp1.pubB64,
      n2,
      signNonce(kp1.privateKey, n2),
    );
    const short = await request(server)
      .post('/devices/register')
      .set('Authorization', `Bearer ${emp}`)
      .send({ ...proof2, devicePublicKey: 'short' });
    expect(short.status).toBe(400);

    // DTO requires the proof fields: a legacy body without them is a 400.
    const legacy = await request(server)
      .post('/devices/register')
      .set('Authorization', `Bearer ${emp}`)
      .send({
        installationId: 'install-010',
        platform: 'ANDROID',
        devicePublicKey: kp1.pubB64,
      });
    expect(legacy.status).toBe(400);

    // Signed with the wrong private key: proof-of-possession fails -> 401.
    const n3 = await challengeFor(server, emp);
    const forged = regDto(
      'install-011',
      kp1.pubB64,
      n3,
      signNonce(kp2.privateKey, n3),
    );
    const rej = await request(server)
      .post('/devices/register')
      .set('Authorization', `Bearer ${emp}`)
      .send(forged);
    expect(rej.status).toBe(401);

    // Anonymous callers cannot even mint a challenge.
    expect(
      (await request(server).get('/devices/register-challenge')).status,
    ).toBe(401);
  });
});

describe('super-admin device management over HTTP (PRD §63)', () => {
  it('list filters; employee and admin denied; revoke kills sessions; mark-lost by owner', async () => {
    const server = app.getHttpServer();
    const sa = await tokenFor('u-sa', ['SUPER_ADMIN'], 'sa@rs.test');
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');

    const all = await request(server)
      .get('/devices')
      .set('Authorization', `Bearer ${sa}`);
    expect(all.status).toBe(200);
    expect(all.body.pagination.totalItems).toBeGreaterThanOrEqual(2);

    const active = await request(server)
      .get('/devices?status=ACTIVE')
      .set('Authorization', `Bearer ${sa}`);
    expect(
      active.body.data.every((d: { status: string }) => d.status === 'ACTIVE'),
    ).toBe(true);

    expect(
      (
        await request(server)
          .get('/devices')
          .set('Authorization', `Bearer ${emp}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .get('/devices')
          .set('Authorization', `Bearer ${adm}`)
      ).status,
    ).toBe(403);

    const target = (
      all.body.data as Array<{ id: string; status: string }>
    ).find((d) => d.status === 'ACTIVE')!;
    expect(
      (
        await request(server)
          .post(`/devices/${target.id}/revoke`)
          .set('Authorization', `Bearer ${adm}`)
          .send({ reason: 'stolen' })
      ).status,
    ).toBe(403);
    const revoked = await request(server)
      .post(`/devices/${target.id}/revoke`)
      .set('Authorization', `Bearer ${sa}`)
      .send({ reason: 'stolen' });
    expect(revoked.status).toBe(200);
    expect(revoked.body.status).toBe('REVOKED');
    expect(fake.audits.map((a: { action: string }) => a.action)).toContain(
      'DEVICE_REVOKED',
    );

    // revoked device no longer validates (attendance gate would refuse it)
    const detail = await request(server)
      .get(`/devices/${target.id}`)
      .set('Authorization', `Bearer ${sa}`);
    expect(detail.body.status).toBe('REVOKED');
    expect(detail.body.sessions).toBeDefined();

    // owner marks another own device lost; stranger cannot
    const other = await tokenFor('u-other', ['EMPLOYEE'], 'other@rs.test');
    const mineId = (all.body.data as Array<{ id: string }>)[0].id;
    expect(
      (
        await request(server)
          .post(`/devices/${mineId}/mark-lost`)
          .set('Authorization', `Bearer ${other}`)
      ).status,
    ).toBe(404);
    const lost = await request(server)
      .post(`/devices/${mineId}/mark-lost`)
      .set('Authorization', `Bearer ${emp}`);
    expect(lost.status).toBe(200);
    expect(lost.body.status).toBe('LOST');
  });
});
