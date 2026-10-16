// STEP 15 HTTP acceptance (PRD §60): correction lifecycle over real HTTP with
// an in-memory Prisma double. DB-backed e2e once live Postgres exists (STEP 25).
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
import { CorrectionsController } from '../src/corrections/corrections.controller.js';
import { CorrectionsService } from '../src/corrections/corrections.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  SUPERVISOR: ['correction:approve:team', 'attendance:read:team'],
  ADMIN: ['correction:approve:team', 'employee:read'],
};

function makeFake() {
  const users = new Map<string, any>([
    ['u-emp', { id: 'u-emp', email: 'emp@rs.test', passwordHash: 'x', isActive: true }],
    ['u-sup', { id: 'u-sup', email: 'sup@rs.test', passwordHash: 'x', isActive: true }],
    ['u-adm', { id: 'u-adm', email: 'adm@rs.test', passwordHash: 'x', isActive: true }],
    ['u-out', { id: 'u-out', email: 'out@rs.test', passwordHash: 'x', isActive: true }],
  ]);
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [
    { userId: 'u-emp', role: 'EMPLOYEE' },
    { userId: 'u-sup', role: 'SUPERVISOR' },
    { userId: 'u-adm', role: 'ADMIN' },
    { userId: 'u-out', role: 'SUPERVISOR' },
  ];
  const employees = new Map<string, any>([
    ['e-emp', { id: 'e-emp', userId: 'u-emp', employeeNo: 'EMP-001', name: 'Siti', supervisorId: 'e-sup', departmentId: 'd1' }],
    ['e-sup', { id: 'e-sup', userId: 'u-sup', employeeNo: 'EMP-002', name: 'Atasan', supervisorId: null, departmentId: 'd1' }],
    ['e-adm', { id: 'e-adm', userId: 'u-adm', employeeNo: 'EMP-003', name: 'Admin', supervisorId: null, departmentId: 'd1' }],
    ['e-out', { id: 'e-out', userId: 'u-out', employeeNo: 'EMP-004', name: 'Luar', supervisorId: null, departmentId: 'd1' }],
  ]);
  const departments = new Map<string, any>([['d1', { id: 'd1', name: 'IGD', hospitalId: 'h1' }]]);
  const shift = {
    id: 's1', name: 'PAGI', startTime: '07:00', endTime: '15:00', overnight: false,
    gracePeriodMin: 15, lateThresholdMin: 30, earlyCheckoutThresholdMin: 15,
  };
  const attendances = new Map<string, any>([
    ['a1', {
      id: 'a1', employeeId: 'e-emp', workDate: new Date('2026-10-05T00:00:00.000Z'), shiftId: 's1', shift,
      checkInAt: new Date('2026-10-05T07:00:00.000Z'), checkInStatus: 'ON_TIME',
      checkOutAt: null, checkOutStatus: null,
    }],
  ]);
  const corrections = new Map<string, any>();
  const audits: any[] = [];
  let seq = 100;

  const fake: Record<string, any> = {
    users, sessions, employees, attendances, corrections, audits, userRoles,
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
    employee: {
      findUnique: async ({ where, include }: any) => {
        let e = null;
        if (where.id) e = employees.get(where.id) ?? null;
        else if ('userId' in where) e = [...employees.values()].find((x) => x.userId === where.userId) ?? null;
        if (!e) return null;
        // Tahap 2 tenant scoping: resolve the employee's facility for
        // `include.department` (hospitalId) lookups.
        if (include?.department) {
          return { ...e, department: e.departmentId ? departments.get(e.departmentId) ?? null : e.department ?? null };
        }
        return { ...e };
      },
    },
    attendance: {
      findUnique: async ({ where, include }: any) => {
        const a = attendances.get(where.id) ?? null;
        if (!a) return null;
        return include?.shift ? { ...a, shift } : { ...a };
      },
      update: async ({ where, data }: any) => {
        const a = attendances.get(where.id);
        Object.assign(a, data);
        return { ...a };
      },
    },
    correctionRequest: {
      findFirst: async ({ where }: any) =>
        [...corrections.values()].find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null,
      findMany: async ({ where, include }: any) => {
        let rows = [...corrections.values()];
        if (where?.employeeId) rows = rows.filter((r) => r.employeeId === where.employeeId);
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        for (const c of where?.AND ?? []) {
          if (c.status) rows = rows.filter((r) => r.status === c.status);
          if (c.employeeId) rows = rows.filter((r) => r.employeeId === c.employeeId);
          if (c.employee?.supervisorId) {
            rows = rows.filter((r) => employees.get(r.employeeId)?.supervisorId === c.employee.supervisorId);
          }
          // Tahap 2 tenant scoping predicate.
          if (c.employee?.department?.hospitalId) {
            rows = rows.filter(
              (r) => departments.get(employees.get(r.employeeId)?.departmentId)?.hospitalId === c.employee.department.hospitalId,
            );
          }
        }
        return rows.map((r) => ({
          ...r,
          ...(include?.employee ? { employee: employees.get(r.employeeId) } : {}),
          ...(include?.attendance ? { attendance: attendances.get(r.attendanceId) } : {}),
        }));
      },
      findUnique: async ({ where, include }: any) => {
        const r = corrections.get(where.id) ?? null;
        if (!r) return null;
        return {
          ...r,
          ...(include?.attendance ? { attendance: attendances.get(r.attendanceId) } : {}),
        };
      },
      create: async ({ data, include }: any) => {
        const r = { id: `c${++seq}`, status: 'PENDING', requestedAt: new Date(), ...data };
        corrections.set(r.id, r);
        return { ...r, ...(include?.attendance ? { attendance: attendances.get(r.attendanceId) } : {}) };
      },
      update: async ({ where, data }: any) => {
        const r = corrections.get(where.id);
        Object.assign(r, data);
        return { ...r };
      },
    },
    session: {
      create: async ({ data }: any) => {
        const s = { id: `s${++seq}`, createdAt: new Date(), revokedAt: null, ...data };
        sessions.set(s.id, s);
        return { ...s };
      },
      findUnique: async ({ where }: any) => sessions.get(where.id) ?? null,
    },
  };
  // Transaction stand-in for the atomic approve path (H4): same models as tx.
  fake.$transaction = async (fn: (tx: unknown) => unknown) => fn(fake);
  return fake;
}

let app: INestApplication;
let fake: ReturnType<typeof makeFake>;
let jwt: JwtService;

async function tokenFor(userId: string, roles: string[]) {
  const s = await fake.session.create({
    data: { userId, refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 86_400_000) },
  });
  return jwt.signAsync({ sub: userId, email: `${userId}@x.test`, roles, sid: s.id });
}

beforeAll(async () => {
  fake = makeFake();

  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'e2e-cor', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [CorrectionsController],
    providers: [
      CorrectionsService,
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

describe('correction lifecycle over HTTP (PRD §60)', () => {
  it('request -> supervisor approve updates attendance + audits', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    const sup = await tokenFor('u-sup', ['SUPERVISOR']);

    const created = await request(server).post('/corrections').set('Authorization', `Bearer ${emp}`).send({
      attendanceId: 'a1',
      type: 'MISSED_CHECK_OUT',
      requestedCheckOut: '2026-10-05T15:05:00.000Z',
      reason: 'Lupa tap pulang',
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING');
    const id = created.body.id as string;

    const dup = await request(server).post('/corrections').set('Authorization', `Bearer ${emp}`).send({
      attendanceId: 'a1',
      type: 'WRONG_TIME',
      requestedCheckIn: '2026-10-05T07:00:00.000Z',
      reason: 'x',
    });
    expect(dup.status).toBe(409);

    const mine = await request(server).get('/corrections/me').set('Authorization', `Bearer ${emp}`);
    expect(mine.body).toHaveLength(1);

    const queue = await request(server).get('/corrections?status=PENDING').set('Authorization', `Bearer ${sup}`);
    expect(queue.status).toBe(200);
    expect(queue.body).toHaveLength(1);

    // employee cannot approve; outsider supervisor cannot approve
    const out = await tokenFor('u-out', ['SUPERVISOR']);
    expect((await request(server).post(`/corrections/${id}/approve`).set('Authorization', `Bearer ${emp}`).send({})).status).toBe(403);
    expect((await request(server).post(`/corrections/${id}/approve`).set('Authorization', `Bearer ${out}`).send({})).status).toBe(403);

    const ok = await request(server).post(`/corrections/${id}/approve`).set('Authorization', `Bearer ${sup}`).send({ reviewNote: 'disetujui' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('APPROVED');

    const att = fake.attendances.get('a1');
    expect(att.checkOutAt).toBeTruthy();
    expect(att.checkOutStatus).toBe('NORMAL_CHECKOUT'); // 15:05 vs 15:00, toleransi 15

    const actions = fake.audits.map((a: { action: string }) => a.action);
    expect(actions).toContain('CORRECTION_CREATED');
    expect(actions).toContain('CORRECTION_APPROVED');
  });

  it('reject + cancel paths', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    const adm = await tokenFor('u-adm', ['ADMIN']);

    const c2 = await request(server).post('/corrections').set('Authorization', `Bearer ${emp}`).send({
      attendanceId: 'a1',
      type: 'WRONG_TIME',
      requestedCheckIn: '2026-10-05T07:10:00.000Z',
      reason: 'salah jam',
    });
    const rej = await request(server).post(`/corrections/${c2.body.id}/reject`).set('Authorization', `Bearer ${adm}`).send({ reviewNote: 'tidak valid' });
    expect(rej.status).toBe(200);
    expect(rej.body.status).toBe('REJECTED');

    const c3 = await request(server).post('/corrections').set('Authorization', `Bearer ${emp}`).send({
      attendanceId: 'a1',
      type: 'TECHNICAL_ISSUE',
      requestedCheckIn: '2026-10-05T07:00:00.000Z',
      reason: 'tap gagal',
    });
    const cancel = await request(server).post(`/corrections/${c3.body.id}/cancel`).set('Authorization', `Bearer ${emp}`);
    expect(cancel.body.status).toBe('CANCELLED');

    expect((await request(server).get('/corrections').set('Authorization', `Bearer ${emp}`)).status).toBe(403);
    expect((await request(server).get('/corrections')).status).toBe(401);
  });
});
