// STEP 6 HTTP acceptance (PRD §51): real HTTP through real guards with an
// in-memory Prisma double. DB-backed e2e runs once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ShiftsController } from '../src/shifts/shifts.controller.js';
import { ShiftsService } from '../src/shifts/shifts.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  SUPERVISOR: ['attendance:read:team'],
  ADMIN: ['shift:manage', 'schedule:manage', 'employee:read'],
  SUPER_ADMIN: ['shift:manage', 'schedule:manage'],
};

function makeFake() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [];
  const hospitals = new Map<string, any>([['h1', { id: 'h1', code: 'RS-A', name: 'RS Contoh' }]]);
  const departments = new Map<string, any>([['d1', { id: 'd1', name: 'IGD', hospitalId: 'h1' }]]);
  const employees = new Map<string, any>([
    ['e1', { id: 'e1', userId: 'u-emp', employeeNo: 'EMP-001', name: 'Karyawan', email: 'employee@rs.test', departmentId: 'd1', status: 'ACTIVE', createdAt: new Date() }],
    // Tahap 2 tenant scoping: the ADMIN actor belongs to the same facility as
    // every fixture. A facility-less admin would correctly see nothing.
    ['e-adm', { id: 'e-adm', userId: 'u-adm', employeeNo: 'EMP-000', name: 'Admin', email: 'admin@rs.test', departmentId: 'd1', status: 'ACTIVE', createdAt: new Date() }],
  ]);
  const shifts = new Map<string, any>();
  const schedules = new Map<string, any>();
  const attendances: any[] = [];
  const audits: any[] = [];
  let seq = 100;

  const matchSchedule = (r: any, where: any): boolean => {
    if (!where || Object.keys(where).length === 0) return true;
    if (where.AND) return where.AND.every((c: any) => matchSchedule(r, c));
    if (where.OR) return where.OR.some((c: any) => matchSchedule(r, c));
    if (where.shift && typeof where.shift === 'object') {
      // Tahap 2 tenant scoping: { shift: { hospitalId } }.
      const s = shifts.get(r.shiftId) ?? null;
      if (!s) return false;
      for (const [k, v] of Object.entries(where.shift) as Array<[string, any]>) {
        if (s[k] !== v) return false;
      }
      return true;
    }
    if (where.employee && typeof where.employee === 'object') {
      const e = employees.get(r.employeeId) ?? null;
      if (!e) return false;
      for (const [k, v] of Object.entries(where.employee) as Array<[string, any]>) {
        if (k === 'department' && v && typeof v === 'object') {
          const dep = e.departmentId ? departments.get(e.departmentId) ?? null : null;
          if (!dep) return false;
          for (const [dk, dv] of Object.entries(v) as Array<[string, unknown]>) {
            if ((dep as Record<string, unknown>)[dk] !== dv) return false;
          }
        } else if (e[k] !== v) return false;
      }
      return true;
    }
    if (where.workDate && typeof where.workDate === 'object') {
      if (where.workDate.gte && !(new Date(r.workDate) >= new Date(where.workDate.gte))) return false;
      if (where.workDate.lte && !(new Date(r.workDate) <= new Date(where.workDate.lte))) return false;
      return true;
    }
    return Object.entries(where).every(([k, v]) => (r as any)[k] === v);
  };

  const fake = {
    users, sessions, shifts, schedules, attendances, audits, userRoles,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = users.get(where.id) ?? null;
        if (!u) return null;
        return include?.userRoles
          ? { ...u, userRoles: userRoles.filter((r) => r.userId === u.id).map((r) => ({ role: { name: r.role } })) }
          : { ...u };
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
    hospital: { findUnique: async ({ where }: any) => hospitals.get(where.id) ?? null },
    employee: {
      findUnique: async ({ where, include }: any) => {
        let e = null;
        if (where.id) e = employees.get(where.id) ?? null;
        else if ('userId' in where) e = [...employees.values()].find((x) => x.userId === where.userId) ?? null;
        if (!e) return null;
        if (include?.department) return { ...e, department: e.departmentId ? departments.get(e.departmentId) ?? null : null };
        return { ...e };
      },
    },
    shift: {
      findUnique: async ({ where, include }: any) => {
        let s = null;
        if (where.id) s = shifts.get(where.id) ?? null;
        else if (where.hospitalId_name) {
          s = [...shifts.values()].find(
            (x) => x.hospitalId === where.hospitalId_name.hospitalId && x.name === where.hospitalId_name.name,
          ) ?? null;
        }
        if (!s) return null;
        return include?.hospital ? { ...s, hospital: hospitals.get(s.hospitalId) } : { ...s };
      },
      findMany: async ({ where }: any) => {
        let rows = [...shifts.values()];
        if (where?.hospitalId) rows = rows.filter((s) => s.hospitalId === where.hospitalId);
        return rows.map((s) => ({ ...s, hospital: hospitals.get(s.hospitalId) }));
      },
      create: async ({ data }: any) => {
        const s = { id: `s${++seq}`, ...data };
        shifts.set(s.id, s);
        return { ...s };
      },
      update: async ({ where, data }: any) => {
        const s = shifts.get(where.id);
        Object.assign(s, data);
        return { ...s };
      },
    },
    employeeSchedule: {
      findUnique: async ({ where, include }: any) => {
        let s = null;
        if (where.id) s = schedules.get(where.id) ?? null;
        else if (where.employeeId_workDate) {
          const t = new Date(where.employeeId_workDate.workDate).getTime();
          s = [...schedules.values()].find(
            (x) => x.employeeId === where.employeeId_workDate.employeeId && new Date(x.workDate).getTime() === t,
          ) ?? null;
        }
        if (!s) return null;
        if (!include) return { ...s };
        return {
          ...s,
          shift: shifts.get(s.shiftId) ?? null,
          employee: (() => {
            const e = employees.get(s.employeeId);
            return e
              ? { id: e.id, name: e.name, employeeNo: e.employeeNo, department: e.departmentId ? departments.get(e.departmentId) ?? null : null }
              : null;
          })(),
        };
      },
      findMany: async ({ where, skip = 0, take }: any) => {
        let rows = [...schedules.values()].filter((r) => matchSchedule(r, where));
        rows = rows.slice(skip, take === undefined ? undefined : skip + take).map((r) => ({
          ...r,
          shift: shifts.get(r.shiftId),
          employee: (() => {
            const e = employees.get(r.employeeId);
            return e ? { id: e.id, name: e.name, employeeNo: e.employeeNo } : null;
          })(),
        }));
        return rows;
      },
      count: async ({ where }: any) => [...schedules.values()].filter((r) => matchSchedule(r, where)).length,
      create: async ({ data, include }: any) => {
        const s = { id: `sch${++seq}`, ...data };
        schedules.set(s.id, s);
        return include ? makeFakeScheduleView(s, shifts, employees) : { ...s };
      },
      delete: async ({ where }: any) => {
        schedules.delete(where.id);
        return { id: where.id };
      },
    },
    attendance: {
      findFirst: async ({ where }: any) =>
        attendances.find((a) => a.scheduleId === where.scheduleId) ?? null,
    },
    session: {
      create: async ({ data }: any) => {
        const s = { id: `s${++seq}`, createdAt: new Date(), revokedAt: null, ...data };
        sessions.set(s.id, s);
        return { ...s };
      },
      findUnique: async ({ where }: any) => sessions.get(where.id) ?? null,
    },
    device: { findUnique: async () => null },
  };
  // Interactive-transaction stand-in for shift/schedule writes that now commit
  // their audit row atomically (see ShiftsService audit atomicity).
  (fake as unknown as Record<string, unknown>).$transaction = async (
    fn: (tx: unknown) => Promise<unknown>,
  ) => fn(fake);
  return fake;
}

function makeFakeScheduleView(s: any, shifts: Map<string, any>, employees: Map<string, any>) {
  const e = employees.get(s.employeeId);
  return {
    ...s,
    shift: shifts.get(s.shiftId),
    employee: e ? { id: e.id, name: e.name, employeeNo: e.employeeNo } : null,
  };
}

let app: INestApplication;
let fake: ReturnType<typeof makeFake>;
let jwt: JwtService;

async function tokenFor(userId: string, roles: string[], email: string) {
  const s = await fake.session.create({
    data: { userId, refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 86_400_000) },
  });
  return jwt.signAsync({ sub: userId, email, roles, sid: s.id });
}

beforeAll(async () => {
  fake = makeFake();
  const seed = [
    ['u-adm', 'admin@rs.test', ['ADMIN']],
    ['u-sup', 'supervisor@rs.test', ['SUPERVISOR']],
    ['u-emp', 'employee@rs.test', ['EMPLOYEE']],
  ] as const;
  for (const [id, email, roles] of seed) {
    fake.users.set(id, { id, email, passwordHash: 'x', isActive: true });
    for (const r of roles) fake.userRoles.push({ userId: id, role: r });
  }
  fake.shifts.set('s-pagi', {
    id: 's-pagi', hospitalId: 'h1', name: 'PAGI', startTime: '07:00', endTime: '15:00',
    overnight: false, gracePeriodMin: 15, lateThresholdMin: 30, earlyCheckoutThresholdMin: 15,
  });

  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'e2e-shift', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [ShiftsController],
    providers: [
      ShiftsService,
      AuthService,
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      { provide: PrismaService, useValue: fake },
      { provide: ConfigService, useValue: { get: (_k: string, d: unknown) => d } },
      { provide: AuditService, useValue: { log: async (e: unknown) => void fake.audits.push(e) } },
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

describe('RBAC on shifts/schedules', () => {
  it('EMPLOYEE and SUPERVISOR get 403; anonymous 401', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    const sup = await tokenFor('u-sup', ['SUPERVISOR'], 'supervisor@rs.test');
    for (const t of [emp, sup]) {
      expect((await request(server).get('/shifts').set('Authorization', `Bearer ${t}`)).status).toBe(403);
      expect((await request(server).post('/shifts').set('Authorization', `Bearer ${t}`).send({})).status).toBe(403);
      expect((await request(server).get('/schedules').set('Authorization', `Bearer ${t}`)).status).toBe(403);
      expect((await request(server).post('/schedules').set('Authorization', `Bearer ${t}`).send({})).status).toBe(403);
    }
    expect((await request(server).get('/shifts')).status).toBe(401);
  });
});

describe('shift CRUD as ADMIN', () => {
  let admin = '';
  const malam = { hospitalId: 'h1', name: 'MALAM', startTime: '23:00', endTime: '07:00' };

  it('creates night shift with derived overnight + validation guards', async () => {
    const server = app.getHttpServer();
    admin = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');

    const created = await request(server).post('/shifts').set('Authorization', `Bearer ${admin}`).send(malam);
    expect(created.status).toBe(201);
    expect(created.body.overnight).toBe(true);
    expect(created.body.gracePeriodMin).toBe(15);

    const badTime = await request(server).post('/shifts').set('Authorization', `Bearer ${admin}`).send({ ...malam, name: 'XX', startTime: '25:00' });
    expect(badTime.status).toBe(400);
    const contra = await request(server).post('/shifts').set('Authorization', `Bearer ${admin}`).send({ ...malam, name: 'YY', overnight: false });
    expect(contra.status).toBe(400);
    const dup = await request(server).post('/shifts').set('Authorization', `Bearer ${admin}`).send(malam);
    expect(dup.status).toBe(409);
    const noHosp = await request(server).post('/shifts').set('Authorization', `Bearer ${admin}`).send({ ...malam, name: 'ZZ', hospitalId: 'hx' });
    expect(noHosp.status).toBe(404);
  });

  it('lists, reads, updates', async () => {
    const server = app.getHttpServer();
    const listed = await request(server).get('/shifts?hospitalId=h1').set('Authorization', `Bearer ${admin}`);
    expect(listed.status).toBe(200);
    expect(listed.body.length).toBe(2); // PAGI seed + MALAM

    const one = await request(server).get('/shifts/s-pagi').set('Authorization', `Bearer ${admin}`);
    expect(one.status).toBe(200);
    expect(one.body.hospital).toMatchObject({ code: 'RS-A' });

    const upd = await request(server).patch('/shifts/s-pagi').set('Authorization', `Bearer ${admin}`).send({ gracePeriodMin: 10 });
    expect(upd.status).toBe(200);
    expect(upd.body.gracePeriodMin).toBe(10);

    const actions = fake.audits.map((a) => a.action);
    expect(actions).toContain('SHIFT_CREATED');
    expect(actions).toContain('SHIFT_UPDATED');
  });
});

describe('schedules as ADMIN', () => {
  let admin = '';
  let malamId = '';

  it('assign night shift, reject double-booking, unassign', async () => {
    const server = app.getHttpServer();
    admin = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    malamId = [...fake.shifts.values()].find((s) => s.name === 'MALAM').id;

    const assigned = await request(server)
      .post('/schedules')
      .set('Authorization', `Bearer ${admin}`)
      .send({ employeeId: 'e1', shiftId: malamId, workDate: '2026-09-23' });
    expect(assigned.status).toBe(201);
    expect(new Date(assigned.body.workDate).toISOString().slice(0, 10)).toBe('2026-09-23');
    const schId = assigned.body.id as string;

    const dup = await request(server)
      .post('/schedules')
      .set('Authorization', `Bearer ${admin}`)
      .send({ employeeId: 'e1', shiftId: 's-pagi', workDate: '2026-09-23' });
    expect(dup.status).toBe(409);

    const listed = await request(server)
      .get('/schedules?employeeId=e1&from=2026-09-01&to=2026-09-30')
      .set('Authorization', `Bearer ${admin}`);
    expect(listed.status).toBe(200);
    expect(listed.body.pagination.totalItems).toBe(1);
    expect(listed.body.data[0].shift.name).toBe('MALAM');
    // Thresholds travel with the roster so the mobile app can preview the
    // on-time/late verdict the server records.
    expect(listed.body.data[0].shift.gracePeriodMin).toBe(15);
    expect(listed.body.data[0].shift.lateThresholdMin).toBe(30);
    expect(listed.body.data[0].shift.earlyCheckoutThresholdMin).toBe(15);

    const gone = await request(server).delete(`/schedules/${schId}`).set('Authorization', `Bearer ${admin}`);
    expect(gone.status).toBe(200);
    expect(fake.audits.map((a) => a.action)).toContain('SCHEDULE_ASSIGNED');
  });

  it('schedule with attendance cannot be removed', async () => {
    const server = app.getHttpServer();
    const assigned = await request(server)
      .post('/schedules')
      .set('Authorization', `Bearer ${admin}`)
      .send({ employeeId: 'e1', shiftId: malamId, workDate: '2026-09-24' });
    const schId = assigned.body.id as string;
    fake.attendances.push({ id: 'a1', scheduleId: schId });
    const blocked = await request(server).delete(`/schedules/${schId}`).set('Authorization', `Bearer ${admin}`);
    expect(blocked.status).toBe(409);
  });
});

describe('own roster (/schedules/me)', () => {
  it('returns the caller shift with its tolerances (no schedule:manage needed)', async () => {
    const server = app.getHttpServer();
    const admin = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const shift = await request(server)
      .post('/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        hospitalId: 'h1',
        name: 'SORE',
        startTime: '13:00',
        endTime: '21:00',
        gracePeriodMin: 12,
        lateThresholdMin: 44,
        earlyCheckoutThresholdMin: 18,
      });
    expect(shift.status).toBe(201);

    const assigned = await request(server)
      .post('/schedules')
      .set('Authorization', `Bearer ${admin}`)
      .send({ employeeId: 'e1', shiftId: shift.body.id, workDate: '2026-09-26' });
    expect(assigned.status).toBe(201);

    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    const res = await request(server)
      .get('/schedules/me?from=2026-09-01&to=2026-09-30&pageSize=100')
      .set('Authorization', `Bearer ${emp}`);
    expect(res.status).toBe(200);
    const row = (res.body.data as any[]).find((r) => r.shift?.name === 'SORE');
    expect(row).toBeTruthy();
    expect(row.shift).toMatchObject({
      gracePeriodMin: 12,
      lateThresholdMin: 44,
      earlyCheckoutThresholdMin: 18,
    });
  });
});
