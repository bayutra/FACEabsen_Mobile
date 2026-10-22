// STEP 20 HTTP acceptance (PRD §65): permission-scoped reports + all export
// formats. DB-backed e2e once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReportsController } from '../src/reports/reports.controller.js';
import { ReportsService } from '../src/reports/reports.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  SUPERVISOR: ['attendance:read:team', 'report:read:team'],
  ADMIN: ['attendance:read:team', 'report:read:team', 'employee:read'],
};

function makeFake() {
  const users = new Map<string, any>([
    [
      'u-sup',
      { id: 'u-sup', email: 'sup@rs.test', passwordHash: 'x', isActive: true },
    ],
    [
      'u-adm',
      { id: 'u-adm', email: 'adm@rs.test', passwordHash: 'x', isActive: true },
    ],
    [
      'u-emp',
      { id: 'u-emp', email: 'emp@rs.test', passwordHash: 'x', isActive: true },
    ],
  ]);
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [
    { userId: 'u-sup', role: 'SUPERVISOR' },
    { userId: 'u-adm', role: 'ADMIN' },
    { userId: 'u-emp', role: 'EMPLOYEE' },
  ];
  const dept = { id: 'd1', name: 'IGD', hospitalId: 'h1' };
  const employees = new Map<string, any>([
    [
      'e-sup',
      {
        id: 'e-sup',
        userId: 'u-sup',
        name: 'Atasan',
        employeeNo: 'EMP-010',
        supervisorId: null,
        department: dept,
      },
    ],
    [
      'e-a',
      {
        id: 'e-a',
        userId: 'u-a',
        name: 'A',
        employeeNo: 'EMP-001',
        supervisorId: 'e-sup',
        department: dept,
      },
    ],
    [
      'e-x',
      {
        id: 'e-x',
        userId: 'u-x',
        name: 'X',
        employeeNo: 'EMP-009',
        supervisorId: 'e-other',
        department: dept,
      },
    ],
    // Tahap 2 tenant scoping: the ADMIN actor belongs to the same facility as
    // every fixture (mirrors prisma/seed.mjs). A facility-less admin would
    // correctly see nothing.
    [
      'e-adm',
      {
        id: 'e-adm',
        userId: 'u-adm',
        name: 'Admin',
        employeeNo: 'EMP-000',
        email: 'adm@rs.test',
        supervisorId: null,
        status: 'ACTIVE',
        departmentId: 'd1',
        department: dept,
        createdAt: new Date(),
      },
    ],
  ]);
  const shift = { id: 's1', name: 'PAGI' };
  const schedules = [
    {
      id: 'sch1',
      employeeId: 'e-a',
      shiftId: 's1',
      workDate: new Date('2026-10-05T00:00:00.000Z'),
      shift,
      employee: employees.get('e-a'),
    },
    {
      id: 'sch2',
      employeeId: 'e-x',
      shiftId: 's1',
      workDate: new Date('2026-10-05T00:00:00.000Z'),
      shift,
      employee: employees.get('e-x'),
    },
  ];
  const attendances = [
    {
      id: 'a1',
      employeeId: 'e-a',
      shiftId: 's1',
      workDate: new Date('2026-10-05T00:00:00.000Z'),
      checkInAt: new Date('2026-10-05T07:20:00.000Z'),
      checkOutAt: null,
      checkInStatus: 'LATE',
      riskScore: 80,
      shift,
      employee: employees.get('e-a'),
    },
    {
      id: 'a2',
      employeeId: 'e-x',
      shiftId: 's1',
      workDate: new Date('2026-10-05T00:00:00.000Z'),
      checkInAt: new Date('2026-10-05T07:00:00.000Z'),
      checkOutAt: null,
      checkInStatus: 'ON_TIME',
      riskScore: 99,
      shift,
      employee: employees.get('e-x'),
    },
  ];
  const leaves: any[] = [];
  let seq = 100;

  const inIds = (ids: string[]) => (id: string) => ids.includes(id);

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
    employee: {
      findUnique: async ({ where, include }: any) => {
        let e = null;
        if (where.id) e = employees.get(where.id) ?? null;
        else if ('userId' in where)
          e =
            [...employees.values()].find((x) => x.userId === where.userId) ??
            null;
        if (!e) return null;
        // Tahap 2 tenant scoping: fixtures embed `department` (incl.
        // hospitalId); `include.department` resolves the same way.
        return include?.department
          ? { ...e, department: e.department ?? null }
          : { ...e };
      },
      findMany: async ({ where }: any) => {
        let rows = [...employees.values()];
        if (where?.supervisorId)
          rows = rows.filter((e) => e.supervisorId === where.supervisorId);
        if (where?.id?.in) rows = rows.filter((e) => inIds(where.id.in)(e.id));
        // Tahap 2 tenant scoping predicate (scopeOf confines ADMIN to facility).
        if (where?.department?.hospitalId)
          rows = rows.filter(
            (e) => e.department?.hospitalId === where.department.hospitalId,
          );
        return rows.map((e) => ({ ...e }));
      },
    },
    employeeSchedule: {
      findMany: async ({ where }: any) => {
        let rows = [...schedules];
        if (where?.employeeId?.in)
          rows = rows.filter((s) => inIds(where.employeeId.in)(s.employeeId));
        if (where?.workDate) {
          if (where.workDate.gte)
            rows = rows.filter(
              (s) => s.workDate >= new Date(where.workDate.gte),
            );
          if (where.workDate.lte)
            rows = rows.filter(
              (s) => s.workDate <= new Date(where.workDate.lte),
            );
        } else if (where?.workDate instanceof Date) {
          rows = rows.filter(
            (s) => s.workDate.getTime() === new Date(where.workDate).getTime(),
          );
        }
        return rows.map((s) => ({ ...s }));
      },
    },
    attendance: {
      findMany: async ({ where }: any) => {
        let rows = [...attendances];
        if (where?.employeeId?.in)
          rows = rows.filter((a) => inIds(where.employeeId.in)(a.employeeId));
        if (where?.workDate && !(where.workDate instanceof Date)) {
          if (where.workDate.gte)
            rows = rows.filter(
              (a) => a.workDate >= new Date(where.workDate.gte),
            );
          if (where.workDate.lte)
            rows = rows.filter(
              (a) => a.workDate <= new Date(where.workDate.lte),
            );
        } else if (where?.workDate instanceof Date) {
          rows = rows.filter(
            (a) => a.workDate.getTime() === new Date(where.workDate).getTime(),
          );
        }
        if (where?.checkInStatus?.in)
          rows = rows.filter((a) =>
            where.checkInStatus.in.includes(a.checkInStatus),
          );
        if (where?.checkInStatus && typeof where.checkInStatus === 'string')
          rows = rows.filter((a) => a.checkInStatus === where.checkInStatus);
        return rows.map((a) => ({ ...a }));
      },
    },
    leaveRequest: {
      findMany: async ({ where }: any) => {
        let rows = [...leaves];
        if (where?.employeeId?.in)
          rows = rows.filter((l) => inIds(where.employeeId.in)(l.employeeId));
        if (where?.status) rows = rows.filter((l) => l.status === where.status);
        return rows.map((l) => ({
          ...l,
          employee: employees.get(l.employeeId),
        }));
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
        secret: 'e2e-rep',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [ReportsController],
    providers: [
      ReportsService,
      AuthService,
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      { provide: PrismaService, useValue: fake },
      {
        provide: ConfigService,
        useValue: { get: (_k: string, d: unknown) => d },
      },
      { provide: AuditService, useValue: { log: async () => undefined } },
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

describe('reports over HTTP (PRD §65)', () => {
  it('supervisor confined to team; admin sees all; employee denied', async () => {
    const server = app.getHttpServer();
    const sup = await tokenFor('u-sup', ['SUPERVISOR']);
    const adm = await tokenFor('u-adm', ['ADMIN']);
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);

    const team = await request(server)
      .get('/reports/daily?date=2026-10-05')
      .set('Authorization', `Bearer ${sup}`);
    expect(team.status).toBe(200);
    expect(team.body.summary).toContainEqual(['Terjadwal', '1']);
    expect(team.body.rows).toHaveLength(1);
    expect(team.body.rows[0][0]).toBe('EMP-001');

    const all = await request(server)
      .get('/reports/daily?date=2026-10-05')
      .set('Authorization', `Bearer ${adm}`);
    expect(all.body.rows).toHaveLength(2);

    expect(
      (
        await request(server)
          .get('/reports/daily?date=2026-10-05')
          .set('Authorization', `Bearer ${emp}`)
      ).status,
    ).toBe(403);
    expect(
      (await request(server).get('/reports/daily?date=2026-10-05')).status,
    ).toBe(401);
  });

  it('all report types render json/csv/xlsx/pdf', async () => {
    const server = app.getHttpServer();
    const adm = await tokenFor('u-adm', ['ADMIN']);
    const auth = { Authorization: `Bearer ${adm}` };

    const monthly = await request(server)
      .get('/reports/monthly?month=2026-10')
      .set(auth);
    expect(monthly.body.summary).toContainEqual(['Terlambat', '1']);

    const dept = await request(server)
      .get('/reports/department?from=2026-10-01&to=2026-10-31')
      .set(auth);
    expect(dept.body.rows[0][0]).toBe('IGD');

    const late = await request(server)
      .get('/reports/late?from=2026-10-01&to=2026-10-31&format=csv')
      .set(auth);
    expect(late.headers['content-type']).toContain('text/csv');
    expect(late.headers['content-disposition']).toContain('.csv');
    expect(late.text).toContain('EMP-001');

    const xlsx = await request(server)
      .get('/reports/late?from=2026-10-01&to=2026-10-31&format=xlsx')
      .set(auth);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');

    const pdf = await request(server)
      .get('/reports/daily?date=2026-10-05&format=pdf')
      .set(auth);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('malformed date/month query params fail with 400 (not silent empty)', async () => {
    const server = app.getHttpServer();
    const adm = await tokenFor('u-adm', ['ADMIN']);
    const auth = { Authorization: `Bearer ${adm}` };

    expect(
      (await request(server).get('/reports/daily?date=kemarin').set(auth))
        .status,
    ).toBe(400);
    expect(
      (await request(server).get('/reports/monthly?month=2026-13').set(auth))
        .status,
    ).toBe(400);
    expect(
      (await request(server).get('/reports/monthly?month=oktober').set(auth))
        .status,
    ).toBe(400);
    expect(
      (
        await request(server)
          .get('/reports/late?from=2026-10-01&to=9999-12-31')
          .set(auth)
      ).status,
    ).toBe(400);
  });
});
