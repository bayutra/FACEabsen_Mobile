// STEP 8 HTTP acceptance (PRD §53): full replacement lifecycle over real HTTP
// with an in-memory Prisma double. DB-backed e2e once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { generateKeyPairSync, sign } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { DeviceChangeController } from '../src/devices/device-change.controller.js';
import { DeviceChangeService } from '../src/devices/device-change.service.js';
import { DevicesController } from '../src/devices/devices.controller.js';
import { DevicesService } from '../src/devices/devices.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  ADMIN: ['device:read', 'device:approve-replacement', 'employee:read'],
  SUPER_ADMIN: ['device:read', 'device:approve-replacement', 'employee:read'],
};

function makeFake(hash: string) {
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
  const changeReqs = new Map<string, any>();
  const audits: any[] = [];
  let seq = 100;

  const fake: any = {
    users,
    sessions,
    employees,
    devices,
    changeReqs,
    audits,
    userRoles,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u =
          [...users.values()].find((x) => x.email === where.email) ??
          users.get(where.id) ??
          null;
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
        const out: any = { ...e };
        if (include?.department)
          out.department = e.departmentId
            ? (departments.get(e.departmentId) ?? null)
            : null;
        if (include?.user) out.user = users.get(e.userId) ?? null;
        return out;
      },
    },
    device: {
      count: async ({ where }: any) =>
        [...devices.values()].filter(
          (d) =>
            (!where?.employeeId || d.employeeId === where.employeeId) &&
            (!where?.status || d.status === where.status) &&
            (!where?.NOT?.id || d.id !== where.NOT.id),
        ).length,
      findFirst: async ({ where }: any) => {
        const rows = [...devices.values()];
        const match = (d: any, w: Record<string, any>) =>
          Object.entries(w).every(([k, v]) =>
            v && typeof v === 'object' && 'not' in v
              ? d[k] !== v.not
              : d[k] === v,
          );
        if (where.OR) {
          return rows.find((d) => where.OR.some((c: any) => match(d, c))) ?? null;
        }
        return rows.find((d) => match(d, where)) ?? null;
      },
      findUnique: async ({ where, include }: any) => {
        const d = devices.get(where.id) ?? null;
        if (!d) return null;
        if (include?.employee) {
          const e = employees.get(d.employeeId);
          return {
            ...d,
            employee: e
              ? {
                  id: e.id,
                  userId: e.userId,
                  name: e.name,
                  employeeNo: e.employeeNo,
                  department: e.departmentId
                    ? (departments.get(e.departmentId) ?? null)
                    : null,
                }
              : null,
          };
        }
        return { ...d };
      },
      findMany: async ({ where }: any) => {
        let rows = [...devices.values()];
        if (where?.employeeId)
          rows = rows.filter((d) => d.employeeId === where.employeeId);
        return rows.map((d) => ({ ...d }));
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
    deviceChangeRequest: {
      findFirst: async ({ where }: any) =>
        [...changeReqs.values()].find((r) =>
          Object.entries(where).every(([k, v]) => r[k] === v),
        ) ?? null,
      findMany: async ({ where, include }: any) => {
        let rows = [...changeReqs.values()].filter((r) => matchReq(r, where));
        return rows.map((r) => ({ ...r, ...(include ? viewReq(r) : {}) }));
      },
      findUnique: async ({ where, include }: any) => {
        const r = changeReqs.get(where.id) ?? null;
        if (!r) return null;
        return { ...r, ...(include ? viewReq(r) : {}) };
      },
      create: async ({ data, include }: any) => {
        const r = {
          id: `r${++seq}`,
          status: 'PENDING',
          requestedAt: new Date(),
          ...data,
        };
        changeReqs.set(r.id, r);
        return { ...r, ...(include ? viewReq(r) : {}) };
      },
      update: async ({ where, data }: any) => {
        const r = changeReqs.get(where.id);
        Object.assign(r, data);
        return { ...r };
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
          if (where.userId && s.userId !== where.userId) continue;
          if (where.deviceId && s.deviceId !== where.deviceId) continue;
          if (where.revokedAt === null && s.revokedAt) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(fake),
  };

  function viewReq(r: any) {
    const e = employees.get(r.employeeId);
    return {
      oldDevice: devices.get(r.oldDeviceId) ?? null,
      newDevice: devices.get(r.newDeviceId) ?? null,
      employee: e
        ? {
            id: e.id,
            name: e.name,
            employeeNo: e.employeeNo,
            department: e.departmentId
              ? (departments.get(e.departmentId) ?? null)
              : null,
          }
        : undefined,
    };
  }

  function matchReq(r: any, where: any): boolean {
    if (!where || Object.keys(where).length === 0) return true;
    if (where.AND) return where.AND.every((c: any) => matchReq(r, c));
    if (where.OR) return where.OR.some((c: any) => matchReq(r, c));
    if (where.employee && typeof where.employee === 'object') {
      // Tahap 2 tenant scoping: { employee: { department: { hospitalId } } }.
      const e = employees.get(r.employeeId) ?? null;
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
    return Object.entries(where).every(([k, v]) => (r as any)[k] === v);
  }

  users.set('u-emp', {
    id: 'u-emp',
    email: 'employee@rs.test',
    passwordHash: hash,
    isActive: true,
  });
  users.set('u-adm', {
    id: 'u-adm',
    email: 'admin@rs.test',
    passwordHash: hash,
    isActive: true,
  });
  users.set('u-sa', {
    id: 'u-sa',
    email: 'sa@rs.test',
    passwordHash: hash,
    isActive: true,
  });
  userRoles.push(
    { userId: 'u-emp', role: 'EMPLOYEE' },
    { userId: 'u-adm', role: 'ADMIN' },
    { userId: 'u-sa', role: 'SUPER_ADMIN' },
  );
  return fake;
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

const reg = async (
  server: unknown,
  token: string,
  installationId: string,
  kp: Keypair,
) => {
  const ch = await request(server as never)
    .get('/devices/register-challenge')
    .set('Authorization', `Bearer ${token}`);
  expect(ch.status).toBe(200);
  const nonce = ch.body.nonce as string;
  return request(server as never)
    .post('/devices/register')
    .set('Authorization', `Bearer ${token}`)
    .send({
      installationId,
      platform: 'ANDROID',
      devicePublicKey: kp.pubB64,
      nonce,
      nonceSignature: sign(
        null,
        Buffer.from(nonce, 'utf8'),
        kp.privateKey,
      ).toString('base64'),
    });
};

interface Keypair {
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
  pubB64: string;
}

function makeKeypair(): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = (publicKey.export({ format: 'der', type: 'spki' }) as Buffer)
    .subarray(-32)
    .toString('base64');
  return { privateKey, pubB64: raw };
}

beforeAll(async () => {
  const hash = await argon2.hash('Password123!');
  fake = makeFake(hash);

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: 'e2e-chg',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [DevicesController, DeviceChangeController],
    providers: [
      DevicesService,
      DeviceChangeService,
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

describe('replacement lifecycle (broken-device case)', () => {
  it('register old ACTIVE + new PENDING, request, approve flips both', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const sa = await tokenFor('u-sa', ['SUPER_ADMIN'], 'sa@rs.test');

    const d1 = (await reg(server, emp, 'install-old-001', makeKeypair())).body;
    const d2 = (await reg(server, emp, 'install-new-002', makeKeypair())).body;
    expect(d1.status).toBe('ACTIVE');
    expect(d2.status).toBe('PENDING');

    const req = await request(server)
      .post('/device-change')
      .set('Authorization', `Bearer ${emp}`)
      .send({ newDeviceId: d2.id, reason: 'BROKEN', password: 'Password123!' });
    expect(req.status).toBe(201);
    expect(req.body.status).toBe('PENDING');
    const reqId = req.body.id as string;

    // employee AND admin cannot approve; wrong password rejected; duplicate rejected
    expect(
      (
        await request(server)
          .post(`/device-change/${reqId}/approve`)
          .set('Authorization', `Bearer ${emp}`)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .post(`/device-change/${reqId}/approve`)
          .set('Authorization', `Bearer ${adm}`)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .post('/device-change')
          .set('Authorization', `Bearer ${emp}`)
          .send({ newDeviceId: d2.id, reason: 'LOST', password: 'Wrong123!' })
      ).status,
    ).toBe(401);

    const mine = await request(server)
      .get('/device-change/me')
      .set('Authorization', `Bearer ${emp}`);
    expect(mine.body).toHaveLength(1);

    const queue = await request(server)
      .get('/device-change?status=PENDING')
      .set('Authorization', `Bearer ${sa}`);
    expect(queue.status).toBe(200);
    expect(queue.body).toHaveLength(1);
    expect(
      (
        await request(server)
          .get('/device-change?status=PENDING')
          .set('Authorization', `Bearer ${adm}`)
      ).status,
    ).toBe(403);

    const ok = await request(server)
      .post(`/device-change/${reqId}/approve`)
      .set('Authorization', `Bearer ${sa}`)
      .send({ reviewNote: 'HP rusak, nota terlampir' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('APPROVED');

    const mine2 = await request(server)
      .get('/devices/me')
      .set('Authorization', `Bearer ${emp}`);
    const byId = Object.fromEntries(
      mine2.body.map((d: any) => [d.id, d.status]),
    );
    expect(byId[d1.id]).toBe('REVOKED');
    expect(byId[d2.id]).toBe('ACTIVE');

    const actions = fake.audits.map((a: any) => a.action);
    expect(actions).toContain('DEVICE_REPLACEMENT_REQUESTED');
    expect(actions).toContain('DEVICE_REPLACED');
    expect(actions).toContain('DEVICE_REVOKED');
  });

  it('reject + cancel paths; double review blocked', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const sa = await tokenFor('u-sa', ['SUPER_ADMIN'], 'sa@rs.test');

    const d3 = (await reg(server, emp, 'install-new-003', makeKeypair())).body;
    const r2 = await request(server)
      .post('/device-change')
      .set('Authorization', `Bearer ${emp}`)
      .send({ newDeviceId: d3.id, reason: 'LOST', password: 'Password123!' });
    expect(
      (
        await request(server)
          .post(`/device-change/${r2.body.id}/reject`)
          .set('Authorization', `Bearer ${adm}`)
          .send({ reviewNote: 'x' })
      ).status,
    ).toBe(403);
    const rej = await request(server)
      .post(`/device-change/${r2.body.id}/reject`)
      .set('Authorization', `Bearer ${sa}`)
      .send({ reviewNote: 'bukti kurang' });
    expect(rej.status).toBe(200);
    expect(rej.body.status).toBe('REJECTED');

    const again = await request(server)
      .post(`/device-change/${r2.body.id}/approve`)
      .set('Authorization', `Bearer ${sa}`)
      .send({});
    expect(again.status).toBe(409);

    const r3 = await request(server)
      .post('/device-change')
      .set('Authorization', `Bearer ${emp}`)
      .send({
        newDeviceId: d3.id,
        reason: 'UPGRADE',
        password: 'Password123!',
      });
    const cancel = await request(server)
      .post(`/device-change/${r3.body.id}/cancel`)
      .set('Authorization', `Bearer ${emp}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED');

    expect((await request(server).get('/device-change')).status).toBe(401);
  });
});
