// STEP 17 HTTP acceptance (PRD §62): team scope enforced over real HTTP with
// an in-memory Prisma double. DB-backed e2e once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { AuditService } from '../src/audit/audit.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupervisorController } from '../src/supervisor/supervisor.controller.js';
import { SupervisorService } from '../src/supervisor/supervisor.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  SUPERVISOR: ['attendance:read:team', 'report:read:team', 'correction:approve:team'],
  ADMIN: ['attendance:read:team', 'report:read:team', 'employee:read'],
};

function makeFake() {
  const users = new Map<string, any>([
    ['u-sup', { id: 'u-sup', email: 'sup@rs.test', passwordHash: 'x', isActive: true }],
    ['u-adm', { id: 'u-adm', email: 'adm@rs.test', passwordHash: 'x', isActive: true }],
    ['u-emp', { id: 'u-emp', email: 'emp@rs.test', passwordHash: 'x', isActive: true }],
  ]);
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [
    { userId: 'u-sup', role: 'SUPERVISOR' },
    { userId: 'u-adm', role: 'ADMIN' },
    { userId: 'u-emp', role: 'EMPLOYEE' },
  ];
  const employees = new Map<string, any>([
    ['e-sup', { id: 'e-sup', userId: 'u-sup', name: 'Atasan', employeeNo: 'EMP-010', supervisorId: null, status: 'ACTIVE', departmentId: 'd1' }],
    ['e-a', { id: 'e-a', userId: 'u-a', name: 'A', employeeNo: 'EMP-001', supervisorId: 'e-sup', status: 'ACTIVE', departmentId: 'd1' }],
    ['e-b', { id: 'e-b', userId: 'u-b', name: 'B', employeeNo: 'EMP-002', supervisorId: 'e-other', status: 'ACTIVE', departmentId: 'd1' }],
    // Tahap 2 tenant scoping: the ADMIN actor belongs to the same facility as
    // every fixture (mirrors prisma/seed.mjs). A facility-less admin would
    // correctly see nothing.
    ['e-adm', { id: 'e-adm', userId: 'u-adm', name: 'Admin', employeeNo: 'EMP-000', email: 'adm@rs.test', supervisorId: null, status: 'ACTIVE', departmentId: 'd1', createdAt: new Date() }],
  ]);
  const departments = new Map<string, any>([['d1', { id: 'd1', name: 'IGD', hospitalId: 'h1' }]]);
  const shift = { id: 's1', name: 'PAGI' };
  const schedules = [
    { id: 'sch1', employeeId: 'e-a', shiftId: 's1', workDate: new Date('2026-10-01T00:00:00.000Z') },
    { id: 'sch2', employeeId: 'e-a', shiftId: 's1', workDate: new Date('2026-10-02T00:00:00.000Z') },
  ];
  const attendances = [
    { id: 'a1', employeeId: 'e-a', shiftId: 's1', workDate: new Date('2026-10-01T00:00:00.000Z'), checkInAt: new Date('2026-10-01T07:20:00.000Z'), checkInStatus: 'LATE', shift },
    { id: 'a2', employeeId: 'e-b', shiftId: 's1', workDate: new Date('2026-10-01T00:00:00.000Z'), checkInAt: new Date('2026-10-01T07:00:00.000Z'), checkInStatus: 'ON_TIME', shift },
  ];
  const leaves = [
    { id: 'l1', employeeId: 'e-a', startDate: new Date('2026-10-02T00:00:00.000Z'), endDate: new Date('2026-10-02T00:00:00.000Z'), status: 'APPROVED' },
  ];
  let seq = 100;

  const inIds = (ids: string[]) => (id: string) => ids.includes(id);

  return {
    users, sessions,
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
      findMany: async ({ where }: any) => {
        let rows = [...employees.values()];
        if (where?.supervisorId) rows = rows.filter((e) => e.supervisorId === where.supervisorId);
        if (where?.status) rows = rows.filter((e) => e.status === where.status);
        // Tahap 2 tenant scoping predicate (ADMIN teamOf confined to facility).
        if (where?.department?.hospitalId) {
          rows = rows.filter(
            (e) => (e.departmentId ? departments.get(e.departmentId)?.hospitalId : e.department?.hospitalId) === where.department.hospitalId,
          );
        }
        return rows.map(({ userId: _u, supervisorId: _s, ...rest }) => rest);
      },
    },
    employeeSchedule: {
      findMany: async ({ where }: any) => {
        let rows = [...schedules];
        if (where?.employeeId?.in) rows = rows.filter((s) => inIds(where.employeeId.in)(s.employeeId));
        if (where?.employeeId && typeof where.employeeId === 'string') rows = rows.filter((s) => s.employeeId === where.employeeId);
        if (where?.workDate?.gte) rows = rows.filter((s) => s.workDate >= new Date(where.workDate.gte));
        if (where?.workDate?.lte) rows = rows.filter((s) => s.workDate <= new Date(where.workDate.lte));
        return rows.map((s) => ({ ...s }));
      },
    },
    attendance: {
      findMany: async ({ where }: any) => {
        let rows = [...attendances];
        const ands = where?.AND ?? [where].filter(Boolean);
        for (const c of ands) {
          if (!c || typeof c !== 'object') continue;
          if (c.employeeId?.in) rows = rows.filter((a) => inIds(c.employeeId.in)(a.employeeId));
          if (typeof c.employeeId === 'string') rows = rows.filter((a) => a.employeeId === c.employeeId);
          if (c.checkInStatus) rows = rows.filter((a) => a.checkInStatus === c.checkInStatus);
          if (c.workDate?.gte) rows = rows.filter((a) => a.workDate >= new Date(c.workDate.gte));
          if (c.workDate?.lte) rows = rows.filter((a) => a.workDate <= new Date(c.workDate.lte));
        }
        return rows.map((a) => ({
          ...a,
          employee: { id: a.employeeId, name: employees.get(a.employeeId)?.name, employeeNo: employees.get(a.employeeId)?.employeeNo },
        }));
      },
    },
    leaveRequest: {
      findMany: async ({ where }: any) => {
        let rows = [...leaves];
        if (where?.employeeId?.in) rows = rows.filter((l) => inIds(where.employeeId.in)(l.employeeId));
        if (where?.status) rows = rows.filter((l) => l.status === where.status);
        if (where?.startDate?.lte) rows = rows.filter((l) => l.startDate <= new Date(where.startDate.lte));
        if (where?.endDate?.gte) rows = rows.filter((l) => l.endDate >= new Date(where.endDate.gte));
        return rows.map((l) => ({ ...l }));
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
    imports: [JwtModule.register({ secret: 'e2e-sup', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [SupervisorController],
    providers: [
      SupervisorService,
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
  jwt = app.get(JwtService);
});

afterAll(async () => {
  await app?.close();
});

describe('supervisor scope over HTTP (PRD §62)', () => {
  it('team, attendance, summary confined to subordinates; outsiders excluded', async () => {
    const server = app.getHttpServer();
    const sup = await tokenFor('u-sup', ['SUPERVISOR']);

    const team = await request(server).get('/supervisor/team').set('Authorization', `Bearer ${sup}`);
    expect(team.status).toBe(200);
    expect(team.body.map((m: { id: string }) => m.id)).toEqual(['e-a']);

    const att = await request(server)
      .get('/supervisor/attendance?from=2026-10-01&to=2026-10-02')
      .set('Authorization', `Bearer ${sup}`);
    expect(att.status).toBe(200);
    expect(att.body.every((a: { employeeId: string }) => a.employeeId === 'e-a')).toBe(true);

    const sum = await request(server)
      .get('/supervisor/summary?from=2026-10-01&to=2026-10-03')
      .set('Authorization', `Bearer ${sup}`);
    expect(sum.status).toBe(200);
    expect(sum.body.totals).toMatchObject({ members: 1, late: 1, onLeave: 1 });

    // other team's member is forbidden; admin passes everywhere
    expect((await request(server).get('/supervisor/team/e-b').set('Authorization', `Bearer ${sup}`)).status).toBe(403);
    const adm = await tokenFor('u-adm', ['ADMIN']);
    expect((await request(server).get('/supervisor/team/e-b').set('Authorization', `Bearer ${adm}`)).status).toBe(200);

    // employee and anon denied
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    expect((await request(server).get('/supervisor/team').set('Authorization', `Bearer ${emp}`)).status).toBe(403);
    expect((await request(server).get('/supervisor/team')).status).toBe(401);

    // privilege escalation attempt: employee pulls another team's summary
    expect(
      (await request(server).get('/supervisor/summary?from=2026-10-01&to=2026-10-03').set('Authorization', `Bearer ${emp}`)).status,
    ).toBe(403);
  });
});
