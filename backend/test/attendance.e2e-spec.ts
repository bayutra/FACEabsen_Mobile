// STEP 12 HTTP acceptance (PRD §57): full check-in/out over real HTTP with real
// crypto (Ed25519 + AES-GCM) and an in-memory Prisma double.
// DB-backed e2e once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { INestApplication } from '@nestjs/common';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AttendanceController } from '../src/attendance/attendance.controller.js';
import { AttendanceService } from '../src/attendance/attendance.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { DeviceChangeService } from '../src/devices/device-change.service.js';
import { DevicesService } from '../src/devices/devices.service.js';
import { TemplateCryptoService } from '../src/face/crypto.service.js';
import { FaceService } from '../src/face/face.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';
import { RiskService } from '../src/risk/risk.service.js';

const ENC_KEY = randomBytes(32).toString('base64');
const CONFIG: Record<string, unknown> = {
  DATA_ENCRYPTION_KEY: ENC_KEY,
  FACE_MATCH_THRESHOLD: 0.5,
  LIVENESS_MAX_AGE_MIN: 10,
  REQUEST_MAX_SKEW_MIN: 5,
  JWT_ACCESS_SECRET: 'e2e-att',
  JWT_ACCESS_TTL_SEC: 900,
};
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUB_B64 = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
const PAIR2 = generateKeyPairSync('ed25519');
const PUB2_B64 = PAIR2.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
const FACE_VEC = Array.from({ length: 192 }, (_, i) => Math.sin(i) / 2);

function makeFake(crypto: TemplateCryptoService) {
  const users = new Map<string, any>([
    ['u1', { id: 'u1', email: 'e1@rs.test', passwordHash: 'x', isActive: true }],
    ['u2', { id: 'u2', email: 'e2@rs.test', passwordHash: 'x', isActive: true }],
    ['u-adm', { id: 'u-adm', email: 'admin@rs.test', passwordHash: 'x', isActive: true }],
  ]);
  const userRoles: Array<{ userId: string; role: string }> = [
    { userId: 'u1', role: 'EMPLOYEE' },
    { userId: 'u2', role: 'EMPLOYEE' },
    { userId: 'u-adm', role: 'ADMIN' },
  ];
  const ROLE_PERMS: Record<string, string[]> = {
    EMPLOYEE: ['attendance:create:self'],
    ADMIN: ['attendance:read', 'employee:read'],
  };
  const sessions = new Map<string, any>();
  const hospital = { id: 'h1', code: 'RS-A', name: 'RS Contoh' };
  const employees = new Map<string, any>([
    ['e1', { id: 'e1', userId: 'u1', employeeNo: 'EMP-001', name: 'Siti', departmentId: 'd1', department: { id: 'd1', name: 'IGD', hospitalId: 'h1', hospital } }],
    ['e2', { id: 'e2', userId: 'u2', employeeNo: 'EMP-002', name: 'Budi', departmentId: 'd1', department: { id: 'd1', name: 'IGD', hospitalId: 'h1', hospital } }],
    // Tahap 2 tenant scoping: the ADMIN actor belongs to the same facility as
    // every fixture (mirrors prisma/seed.mjs).
    ['e-adm', { id: 'e-adm', userId: 'u-adm', employeeNo: 'EMP-000', name: 'Admin', departmentId: 'd1', department: { id: 'd1', name: 'IGD', hospitalId: 'h1', hospital } }],
  ]);
  const devices = new Map<string, any>([
    ['d1', { id: 'd1', employeeId: 'e1', status: 'ACTIVE', devicePublicKey: PUB_B64 }],
    ['d2', { id: 'd2', employeeId: 'e2', status: 'ACTIVE', devicePublicKey: PUB2_B64 }],
    ['d3', { id: 'd3', employeeId: 'e1', status: 'REVOKED', devicePublicKey: PUB_B64 }],
    ['d4', { id: 'd4', employeeId: 'e1', status: 'PENDING', devicePublicKey: PUB_B64 }],
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const shift = {
    id: 's1', name: 'PAGI', startTime: '00:00', endTime: '23:59', overnight: false,
    gracePeriodMin: 15, lateThresholdMin: 30, earlyCheckoutThresholdMin: 15,
  };
  const schedules = new Map<string, any>([
    ['sch1', { id: 'sch1', employeeId: 'e1', shiftId: 's1', workDate: new Date(`${today}T00:00:00.000Z`), shift }],
    ['sch2', { id: 'sch2', employeeId: 'e2', shiftId: 's1', workDate: new Date(`${today}T00:00:00.000Z`), shift }],
  ]);
  const attendances = new Map<string, any>();
  const faces = new Map<string, any>();
  const consents = new Map<string, any>([
    ['e1:BIOMETRIC_ATTENDANCE', { id: 'c-e1', employeeId: 'e1', purpose: 'BIOMETRIC_ATTENDANCE', version: '2026-10-01', revokedAt: null }],
    ['e2:BIOMETRIC_ATTENDANCE', { id: 'c-e2', employeeId: 'e2', purpose: 'BIOMETRIC_ATTENDANCE', version: '2026-10-01', revokedAt: null }],
  ]);
  const idem = new Set<string>();
  const audits: any[] = [];
  let seq = 100;

  // stored template = encrypted FACE_VEC
  const floats = Float32Array.from(FACE_VEC);
  const cipher = crypto.encrypt(Buffer.from(floats.buffer), 'e1');
  faces.set('e1', { id: 'f1', employeeId: 'e1', templateCipher: new Uint8Array(cipher), version: 1 });

  const matchAttendanceWhere = (a: any, where: any): boolean => {
    if (!where || !where.AND) return true;
    return where.AND.every((c: any) => {
      if (c.employeeId) return a.employeeId === c.employeeId;
      if (c.checkInStatus) return a.checkInStatus === c.checkInStatus;
      if (c.riskCategory) return a.riskCategory === c.riskCategory;
      if ('needsReview' in c) return (a.needsReview ?? false) === c.needsReview;
      if (c.workDate?.gte) return new Date(a.workDate) >= new Date(c.workDate.gte);
      if (c.workDate?.lte) return new Date(a.workDate) <= new Date(c.workDate.lte);
      if (c.employee) {
        const e = employees.get(a.employeeId);
        if (c.employee.departmentId && e?.departmentId !== c.employee.departmentId) return false;
        // Tahap 2 tenant scoping predicate.
        if (c.employee.department?.hospitalId && e?.department?.hospitalId !== c.employee.department.hospitalId) return false;
        if (c.employee.OR) {
          const hit = c.employee.OR.some((o: any) =>
            Object.entries(o).some(([k, v]: [string, any]) => {
              const val = e?.[k];
              if (v && typeof v === 'object' && 'contains' in v) {
                const s = String(val ?? '');
                const q = String(v.contains);
                return v.mode === 'insensitive' ? s.toLowerCase().includes(q.toLowerCase()) : s.includes(q);
              }
              return val === v;
            }),
          );
          if (!hit) return false;
        }
      }
      return true;
    });
  };

  const withAttendanceIncludes = (a: any, include: any) => {
    if (!include) return { ...a };
    const out: any = { ...a };
    if (include.shift) out.shift = shift;
    if (include.employee) {
      const e = employees.get(a.employeeId);
      out.employee = e
        ? { id: e.id, userId: e.userId, name: e.name, employeeNo: e.employeeNo, department: { id: 'd1', name: 'IGD', hospitalId: 'h1' } }
        : null;
    }
    if (include.device) out.device = { id: a.deviceId, deviceName: 'J2', platform: 'ANDROID' };
    return out;
  };

  return {
    users, sessions, employees, devices, schedules, attendances, faces, audits,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = users.get(where.id) ?? null;
        if (!u) return null;
        return include?.userRoles ? { ...u, userRoles: [{ role: { name: 'EMPLOYEE' } }] } : { ...u };
      },
    },
    userRole: {
      findMany: async ({ where, include }: any) => {
        const roles = userRoles.filter((r) => r.userId === where.userId).map((r) => r.role);
        if (include?.role?.include?.rolePermissions) {
          return roles.map((r) => ({
            role: { name: r, rolePermissions: (ROLE_PERMS[r] ?? []).map((key) => ({ permission: { key } })) },
          }));
        }
        return roles.map((r) => ({ role: { name: r } }));
      },
    },
    employee: {
      findUnique: async ({ where, include }: any) => {
        let e = null;
        if (where.id) e = employees.get(where.id) ?? null;
        else if ('userId' in where) e = [...employees.values()].find((x) => x.userId === where.userId) ?? null;
        if (!e) return null;
        return include?.department ? { ...e } : { ...e };
      },
    },
    device: {
      findUnique: async ({ where, include }: any) => {
        const d = devices.get(where.id) ?? null;
        if (!d) return null;
        if (include?.employee) {
          const e = employees.get(d.employeeId);
          return { ...d, employee: e ? { id: e.id, userId: e.userId } : null };
        }
        return { ...d };
      },
      findFirst: async ({ where }: any) => {
        const rows = [...devices.values()];
        if (where.OR) {
          return rows.find((d) => where.OR.some((c: any) => Object.entries(c).every(([k, v]) => d[k] === v))) ?? null;
        }
        return rows.find((d) => Object.entries(where).every(([k, v]) => d[k] === v)) ?? null;
      },
    },
    employeeSchedule: {
      findUnique: async ({ where, include }: any) => {
        if (where.id) {
          const s = schedules.get(where.id) ?? null;
          return s && include ? { ...s, shift, employee: { id: s.employeeId } } : s ? { ...s } : null;
        }
        const c = where.employeeId_workDate;
        const t = new Date(c.workDate).getTime();
        const s = [...schedules.values()].find(
          (x) => x.employeeId === c.employeeId && new Date(x.workDate).getTime() === t,
        ) ?? null;
        return s && include ? { ...s, shift } : s ? { ...s } : null;
      },
    },
    attendance: {
      findFirst: async ({ where, include, orderBy }: any) => {
        void orderBy;
        let rows = [...attendances.values()];
        if (where.employeeId) rows = rows.filter((a) => a.employeeId === where.employeeId);
        if ('checkOutAt' in where) rows = rows.filter((a) => (a.checkOutAt ?? null) === null);
        if (where.scheduleId) rows = rows.filter((a) => a.scheduleId === where.scheduleId);
        const a = rows[rows.length - 1] ?? null;
        if (!a) return null;
        return include?.shift ? { ...a, shift } : { ...a };
      },
      findMany: async ({ where, skip = 0, take, include }: any) => {
        let rows = [...attendances.values()].filter((a) => matchAttendanceWhere(a, where));
        rows = rows
          .sort((x, y) => new Date(y.workDate).getTime() - new Date(x.workDate).getTime())
          .slice(skip, take === undefined ? undefined : skip + take);
        return rows.map((a) => withAttendanceIncludes(a, include));
      },
      count: async ({ where }: any) => [...attendances.values()].filter((a) => matchAttendanceWhere(a, where)).length,
      findUnique: async ({ where, include }: any) => {
        const a = attendances.get(where.id) ?? null;
        if (!a) return null;
        return withAttendanceIncludes(a, include);
      },
      create: async ({ data }: any) => {
        const a = { id: `a${++seq}`, ...data };
        attendances.set(a.id, a);
        return { ...a };
      },
      update: async ({ where, data }: any) => {
        const a = attendances.get(where.id);
        Object.assign(a, data);
        return { ...a };
      },
    },
    faceTemplate: {
      findUnique: async ({ where }: any) => faces.get(where.employeeId) ?? null,
    },
    consent: {
      findUnique: async ({ where }: any) =>
        consents.get(`${where.employeeId_purpose.employeeId}:${where.employeeId_purpose.purpose}`) ?? null,
    },
    idempotencyKey: {
      deleteMany: async () => ({ count: 0 }),
      create: async ({ data }: any) => {
        if (idem.has(data.key)) throw { code: 'P2002' };
        idem.add(data.key);
        return { ...data };
      },
    },
  };
}

let app: INestApplication;
let fake: ReturnType<typeof makeFake>;
let jwt: JwtService;

async function tokenFor(userId: string, roles: string[] = ['EMPLOYEE']) {
  const s = await fake.session.create?.({
    data: { userId, refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 86_400_000) },
  }) ?? { id: 'sx' };
  return jwt.signAsync({ sub: userId, email: `${userId}@rs.test`, roles, sid: (s as { id: string }).id });
}

// session fake is minimal (create/findUnique)
function withSessionStore(f: ReturnType<typeof makeFake>) {
  const sessions = new Map<string, any>();
  let seq = 500;
  (f as Record<string, unknown>).session = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const s = { id: `s${++seq}`, revokedAt: null, ...data };
      sessions.set(s.id, s);
      return { ...s };
    },
    findUnique: async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null,
  };
  return f;
}

function signals(over: Record<string, unknown> = {}) {
  const requestId = randomUUID();
  const requestTimestamp = new Date().toISOString();
  const sig = sign(null, Buffer.from(`${requestId}.${requestTimestamp}`, 'utf8'), privateKey).toString('base64');
  return {
    deviceId: 'd1',
    faceEmbedding: [...FACE_VEC],
    liveness: { passed: true, challenges: ['blink'], completedAt: new Date().toISOString(), score: 1 },
    requestId,
    requestTimestamp,
    signature: sig,
    deviceCompromised: false,
    ...over,
  };
}

beforeAll(async () => {
  const cryptoProbe = new TemplateCryptoService({ get: (k: string) => CONFIG[k] } as never);
  fake = withSessionStore(makeFake(cryptoProbe));

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: 'e2e-att', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } }),
      ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    ],
    controllers: [AttendanceController],
    providers: [
      AttendanceService,
      DevicesService,
      DeviceChangeService,
      FaceService,
      TemplateCryptoService,
      PrivacyService,
      RiskService,
      AuthService,
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: PrismaService, useValue: fake },
      { provide: ConfigService, useValue: { get: (k: string, d: unknown) => CONFIG[k] ?? d } },
      { provide: AuditService, useValue: { log: async (e: unknown) => void (fake.audits as unknown[]).push(e) } },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  jwt = app.get(JwtService);
});

afterAll(async () => {
  await app?.close();
});

describe('attendance lifecycle over HTTP (PRD §57)', () => {
  it('check-in -> duplicate guards -> check-out', async () => {
    const server = app.getHttpServer();
    const t1 = await tokenFor('u1');
    const auth = { Authorization: `Bearer ${t1}` };

    const in1 = await request(server).post('/attendance/check-in').set(auth).send(signals());
    expect(in1.status).toBe(200);
    expect(in1.body.faceMatch).toMatchObject({ matched: true });
    expect(in1.body.risk).toMatchObject({ score: 100, category: 'LOW', needsReview: false });

    // same requestId twice:
    const s = signals();
    await request(server).post('/attendance/check-in').set(auth).send(s);
    const dup = await request(server).post('/attendance/check-in').set(auth).send(s);
    expect(dup.status).toBe(409);
    expect(dup.body.reason).toBe('DUPLICATE_REQUEST');

    const again = await request(server).post('/attendance/check-in').set(auth).send(signals());
    expect(again.status).toBe(422);
    expect(again.body.reason).toBe('ALREADY_CHECKED_IN');

    const out = await request(server).post('/attendance/check-out').set(auth).send(signals());
    expect(out.status).toBe(200);
    expect(out.body.checkOutAt).toBeTruthy();

    const out2 = await request(server).post('/attendance/check-out').set(auth).send(signals());
    expect(out2.status).toBe(422);
    expect(out2.body.reason).toBe('NO_OPEN_ATTENDANCE');

    const actions = (fake.audits as Array<{ action: string }>).map((a) => a.action);
    expect(actions).toContain('CHECK_IN');
    expect(actions).toContain('CHECK_OUT');
    expect(actions).toContain('ATTENDANCE_REJECTED');
  });

  it('rejects: bad signature, wrong face, no schedule/template', async () => {
    const server = app.getHttpServer();
    const t1 = await tokenFor('u1');
    const auth = { Authorization: `Bearer ${t1}` };

    const badSig = await request(server).post('/attendance/check-in').set(auth).send(signals({ signature: 'A'.repeat(88) }));
    expect(badSig.status).toBe(422);
    expect(badSig.body.reason).toBe('INVALID_SIGNATURE');

    const wrongFace = await request(server)
      .post('/attendance/check-in')
      .set(auth)
      .send(signals({ faceEmbedding: FACE_VEC.map((v) => -v) }));
    expect(wrongFace.body.reason).toBe('FACE_MISMATCH');
    // cos(v,-v) = -1 → face 0 + 55 = 55 HIGH (non-face weights sum to 55),
    // still scored even though the punch is rejected.
    expect(wrongFace.body).toMatchObject({ riskScore: 55, riskCategory: 'HIGH' });

    // u2 owns d2 (signed by PAIR2), has schedule, but never registered a face
    const t2 = await tokenFor('u2');
    const s2 = signals({ deviceId: 'd2' });
    s2.signature = sign(null, Buffer.from(`${s2.requestId}.${s2.requestTimestamp}`, 'utf8'), PAIR2.privateKey).toString('base64');
    const noFace = await request(server).post('/attendance/check-in').set({ Authorization: `Bearer ${t2}` }).send(s2);
    expect(noFace.status).toBe(422);
    expect(noFace.body.reason).toBe('NO_FACE_TEMPLATE');
  });
});

describe('history endpoints over HTTP (PRD §59)', () => {
  const day = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  it('seeds varied rows', () => {
    const rows = [
      { id: 'h-old', employeeId: 'e1', shiftId: 's1', workDate: new Date(`${day(-5)}T00:00:00.000Z`), checkInAt: new Date(`${day(-5)}T07:20:00.000Z`), checkInStatus: 'LATE', checkOutAt: new Date(`${day(-5)}T15:00:00.000Z`), checkOutStatus: 'NORMAL_CHECKOUT', riskScore: 85, riskCategory: 'MEDIUM', needsReview: true },
      { id: 'h-e2', employeeId: 'e2', shiftId: 's1', workDate: new Date(`${day(0)}T00:00:00.000Z`), checkInAt: new Date(`${day(0)}T07:01:00.000Z`), checkInStatus: 'ON_TIME', riskScore: 99, riskCategory: 'LOW', needsReview: false },
    ];
    for (const r of rows) (fake.attendances as Map<string, unknown>).set(r.id, r);
    expect(true).toBe(true);
  });

  it('me is owner-scoped with filters; admin queue filters; RBAC enforced', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u1');
    const adm = await tokenFor('u-adm', ['ADMIN']);

    const me = await request(server).get('/attendance/me').set('Authorization', `Bearer ${emp}`);
    expect(me.status).toBe(200);
    expect(me.body.pagination.totalItems).toBeGreaterThanOrEqual(2);
    expect(me.body.data.every((r: { employeeId: string }) => r.employeeId === 'e1')).toBe(true);

    const late = await request(server).get('/attendance/me?checkInStatus=LATE').set('Authorization', `Bearer ${emp}`);
    expect(late.body.data.every((r: { checkInStatus: string }) => r.checkInStatus === 'LATE')).toBe(true);

    // admin queue
    const all = await request(server).get('/attendance').set('Authorization', `Bearer ${adm}`);
    expect(all.status).toBe(200);
    expect(all.body.pagination.totalItems).toBeGreaterThanOrEqual(3);

    const search = await request(server).get('/attendance?search=EMP-002').set('Authorization', `Bearer ${adm}`);
    expect(search.body.data.every((r: { employee: { employeeNo: string } }) => r.employee.employeeNo === 'EMP-002')).toBe(true);

    const flagged = await request(server).get('/attendance?needsReview=true').set('Authorization', `Bearer ${adm}`);
    expect(flagged.body.data.every((r: { needsReview: boolean }) => r.needsReview === true)).toBe(true);

    // RBAC: employee denied admin queue; stranger denied detail; admin reads all
    expect((await request(server).get('/attendance').set('Authorization', `Bearer ${emp}`)).status).toBe(403);
    const oneId = (me.body.data[0] as { id: string }).id;
    expect((await request(server).get(`/attendance/${oneId}`).set('Authorization', `Bearer ${emp}`)).status).toBe(200);
    expect((await request(server).get('/attendance/h-e2').set('Authorization', `Bearer ${emp}`)).status).toBe(404);
    expect((await request(server).get('/attendance/h-e2').set('Authorization', `Bearer ${adm}`)).status).toBe(200);
    expect((await request(server).get('/attendance/me')).status).toBe(401);
  });
});

describe('attack simulations (PRD §69)', () => {
  it('stale/fake liveness + stolen devices all rejected + audited', async () => {
    const server = app.getHttpServer();
    const t1 = await tokenFor('u1');
    const auth = { Authorization: `Bearer ${t1}` };

    // 1. Photo face: liveness never passed
    const photo = await request(server).post('/attendance/check-in').set(auth).send(
      signals({ liveness: { passed: false, challenges: [], completedAt: new Date().toISOString(), score: 0 } }),
    );
    expect(photo.status).toBe(422);
    expect(photo.body.reason).toBe('LIVENESS_FAILED');

    // 3. Video replay: stale attestation
    const replay = await request(server).post('/attendance/check-in').set(auth).send(
      signals({
        liveness: { passed: true, challenges: ['blink'], completedAt: new Date(Date.now() - 30 * 60_000).toISOString(), score: 1 },
      }),
    );
    expect(replay.status).toBe(422);
    expect(replay.body.reason).toBe('LIVENESS_STALE');

    // 4. Revoked (stolen) device
    const stolen = await request(server).post('/attendance/check-in').set(auth).send(signals({ deviceId: 'd3' }));
    expect(stolen.status).toBe(422);
    expect(stolen.body.reason).toBe('DEVICE_NOT_ACTIVE');

    // 5. Account sharing: second device never activated
    const shared = await request(server).post('/attendance/check-in').set(auth).send(signals({ deviceId: 'd4' }));
    expect(shared.status).toBe(422);
    expect(shared.body.reason).toBe('DEVICE_NOT_ACTIVE');

    // 6. Tampered JWT payload (role escalated, signature broken)
    const [, payloadB64] = t1.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    payload.roles = ['SUPER_ADMIN'];
    const forged = `${t1.split('.')[0]}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${t1.split('.')[2]}`;
    expect((await request(server).get('/attendance/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);

    const denied = (fake.audits as Array<{ action: string; metadata?: { reason?: string } }>)
      .filter((a) => a.action === 'ATTENDANCE_REJECTED')
      .map((a) => a.metadata?.reason);
    for (const r of ['LIVENESS_FAILED', 'LIVENESS_STALE', 'DEVICE_NOT_ACTIVE']) {
      expect(denied).toContain(r);
    }
  });
});

describe('abuse throttling on attendance (STEP 22)', () => {
  it('31st rapid signed request gets 429', async () => {
    const server = app.getHttpServer();
    const t1 = await tokenFor('u1');
    const auth = { Authorization: `Bearer ${t1}` };
    let last = 0;
    for (let i = 0; i < 31; i++) {
      const r = await request(server).post('/attendance/check-in').set(auth).send(signals());
      last = r.status;
    }
    expect(last).toBe(429);
  });
});
