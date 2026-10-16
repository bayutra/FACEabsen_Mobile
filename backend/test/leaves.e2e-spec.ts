// STEP 16 HTTP acceptance (PRD §61): leave lifecycle over real HTTP with an
// in-memory Prisma double. DB-backed e2e once live Postgres exists (STEP 25).
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
import { LeavesController } from '../src/leaves/leaves.controller.js';
import { LeavesService } from '../src/leaves/leaves.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['leave:create:self'],
  SUPERVISOR: ['leave:approve:team'],
  ADMIN: ['leave:approve:team', 'employee:read'],
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
    ['e-out', { id: 'e-out', userId: 'u-out', employeeNo: 'EMP-004', name: 'Luar', supervisorId: null, departmentId: 'd1' }],
    // Tahap 2 tenant scoping: the ADMIN actor belongs to the same facility as
    // every fixture (mirrors prisma/seed.mjs). A facility-less admin would
    // correctly see nothing.
    ['e-adm', { id: 'e-adm', userId: 'u-adm', employeeNo: 'EMP-000', name: 'Admin', email: 'adm@rs.test', departmentId: 'd1', status: 'ACTIVE', supervisorId: null, createdAt: new Date() }],
  ]);
  const departments = new Map<string, any>([['d1', { id: 'd1', name: 'IGD', hospitalId: 'h1' }]]);
  const leaves = new Map<string, any>();
  const audits: any[] = [];
  let seq = 100;

  const overlap = (employeeId: string, start: Date, end: Date, statuses: string[]) =>
    [...leaves.values()].find(
      (r) =>
        r.employeeId === employeeId &&
        statuses.includes(r.status) &&
        new Date(r.startDate) <= end &&
        new Date(r.endDate) >= start,
    ) ?? null;

  return {
    users, sessions, employees, leaves, audits, userRoles,
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
    leaveRequest: {
      findFirst: async ({ where }: any) => {
        if (where.status?.in) {
          return overlap(where.employeeId, new Date(where.endDate.gte), new Date(where.startDate.lte), where.status.in);
        }
        return [...leaves.values()].find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;
      },
      findMany: async ({ where, include }: any) => {
        let rows = [...leaves.values()];
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
        }));
      },
      findUnique: async ({ where }: any) => leaves.get(where.id) ?? null,
      create: async ({ data }: any) => {
        const r = { id: `l${++seq}`, status: 'PENDING', requestedAt: new Date(), ...data };
        leaves.set(r.id, r);
        return { ...r };
      },
      update: async ({ where, data }: any) => {
        const r = leaves.get(where.id);
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
    imports: [JwtModule.register({ secret: 'e2e-lea', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [LeavesController],
    providers: [
      LeavesService,
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

describe('leave lifecycle over HTTP (PRD §61)', () => {
  const dto = {
    type: 'CUTI',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    reason: 'Acara keluarga',
  };

  it('request -> supervisor approve + audits; overlap and scope enforced', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    const sup = await tokenFor('u-sup', ['SUPERVISOR']);

    const created = await request(server).post('/leaves').set('Authorization', `Bearer ${emp}`).send(dto);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING');
    const id = created.body.id as string;

    const clash = await request(server).post('/leaves').set('Authorization', `Bearer ${emp}`).send({
      ...dto, type: 'IZIN', startDate: '2026-11-11', endDate: '2026-11-13',
    });
    expect(clash.status).toBe(409);

    const bad = await request(server).post('/leaves').set('Authorization', `Bearer ${emp}`).send({
      ...dto, startDate: '2026-11-12', endDate: '2026-11-10',
    });
    expect(bad.status).toBe(422);

    const mine = await request(server).get('/leaves/me').set('Authorization', `Bearer ${emp}`);
    expect(mine.body).toHaveLength(1);

    const queue = await request(server).get('/leaves?status=PENDING').set('Authorization', `Bearer ${sup}`);
    expect(queue.status).toBe(200);
    expect(queue.body).toHaveLength(1);

    expect((await request(server).post(`/leaves/${id}/approve`).set('Authorization', `Bearer ${emp}`).send({})).status).toBe(403);
    const out = await tokenFor('u-out', ['SUPERVISOR']);
    expect((await request(server).post(`/leaves/${id}/approve`).set('Authorization', `Bearer ${out}`).send({})).status).toBe(403);

    const ok = await request(server).post(`/leaves/${id}/approve`).set('Authorization', `Bearer ${sup}`).send({ reviewNote: 'ok' });
    expect(ok.body.status).toBe('APPROVED');

    const actions = fake.audits.map((a: { action: string }) => a.action);
    expect(actions).toContain('LEAVE_CREATED');
    expect(actions).toContain('LEAVE_APPROVED');
  });

  it('reject + cancel paths', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    const adm = await tokenFor('u-adm', ['ADMIN']);

    const c2 = await request(server).post('/leaves').set('Authorization', `Bearer ${emp}`).send({
      ...dto, type: 'SAKIT', startDate: '2026-12-01', endDate: '2026-12-02',
    });
    const rej = await request(server).post(`/leaves/${c2.body.id}/reject`).set('Authorization', `Bearer ${adm}`).send({});
    expect(rej.body.status).toBe('REJECTED');

    const c3 = await request(server).post('/leaves').set('Authorization', `Bearer ${emp}`).send({
      ...dto, type: 'DINAS', startDate: '2026-12-10', endDate: '2026-12-11',
    });
    const cancel = await request(server).post(`/leaves/${c3.body.id}/cancel`).set('Authorization', `Bearer ${emp}`);
    expect(cancel.body.status).toBe('CANCELLED');

    expect((await request(server).get('/leaves').set('Authorization', `Bearer ${emp}`)).status).toBe(403);
    expect((await request(server).get('/leaves')).status).toBe(401);
  });
});
