// Dashboard aggregate e2e: GET /dashboard/summary returns scoped counts in
// a single request instead of the six parallel calls the overview used.
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { DashboardController } from '../src/dashboard/dashboard.controller.js';
import { DashboardSummaryService } from '../src/dashboard/dashboard-summary.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReportsService } from '../src/reports/reports.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self'],
  SUPERVISOR: ['attendance:read:team', 'report:read:team'],
  ADMIN: ['attendance:read:team', 'report:read:team', 'employee:read'],
  SUPER_ADMIN: [
    'attendance:read:team',
    'report:read:team',
    'employee:read',
    'device:read',
    'audit:read',
  ],
};

function makeFake() {
  const users = new Map<string, any>([
    ['u-sup', { id: 'u-sup', email: 'sup@rs.test', passwordHash: 'x', isActive: true }],
    ['u-sa', { id: 'u-sa', email: 'sa@rs.test', passwordHash: 'x', isActive: true }],
    ['u-adm', { id: 'u-adm', email: 'adm@rs.test', passwordHash: 'x', isActive: true }],
    ['u-emp', { id: 'u-emp', email: 'emp@rs.test', passwordHash: 'x', isActive: true }],
  ]);
  const sessions = new Map<string, any>();
  const userRoles: Array<{ userId: string; role: string }> = [
    { userId: 'u-sup', role: 'SUPERVISOR' },
    { userId: 'u-sa', role: 'SUPER_ADMIN' },
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
      'e-sa',
      {
        id: 'e-sa',
        userId: 'u-sa',
        name: 'Sa',
        employeeNo: 'EMP-000',
        supervisorId: null,
        department: dept,
      },
    ],
    [
      'e-adm',
      {
        id: 'e-adm',
        userId: 'u-adm',
        name: 'Admin',
        employeeNo: 'EMP-003',
        supervisorId: null,
        department: dept,
      },
    ],
    [
      'e-emp',
      {
        id: 'e-emp',
        userId: 'u-emp',
        name: 'Karyawan',
        employeeNo: 'EMP-004',
        supervisorId: 'e-sup',
        department: dept,
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
  ];
  const attendances = [
    {
      id: 'a1',
      employeeId: 'e-a',
      shiftId: 's1',
      workDate: new Date('2026-10-05T00:00:00.000Z'),
      checkInAt: new Date('2026-10-05T07:00:00.000Z'),
      checkOutAt: null,
      checkInStatus: 'ON_TIME',
      needsReview: true,
      riskScore: 10,
      shift,
      employee: employees.get('e-a'),
    },
    {
      id: 'a2',
      employeeId: 'e-a',
      shiftId: 's1',
      workDate: new Date('2026-10-04T00:00:00.000Z'),
      checkInAt: new Date('2026-10-04T07:00:00.000Z'),
      checkOutAt: null,
      checkInStatus: 'ON_TIME',
      needsReview: false,
      riskScore: 10,
      shift,
      employee: employees.get('e-a'),
    },
  ];
  const corrections = [
    { id: 'c1', employeeId: 'e-a', status: 'PENDING' },
    { id: 'c2', employeeId: 'e-a', status: 'APPROVED' },
  ];
  const leaves = [{ id: 'l1', employeeId: 'e-a', status: 'PENDING' }];
  const devices = [
    { id: 'dev1', status: 'PENDING', employee: employees.get('e-a') },
    { id: 'dev2', status: 'ACTIVE', employee: employees.get('e-a') },
  ];
  const auditRows = [
    { id: 'au1', action: 'LOGIN', result: 'SUCCESS', timestamp: new Date('2026-10-05T01:00:00.000Z'), actor: null, device: null },
  ];
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
          e = [...employees.values()].find((x) => x.userId === where.userId) ?? null;
        if (!e) return null;
        return include?.department
          ? { ...e, department: e.department ?? null }
          : { ...e };
      },
      findMany: async ({ where }: any) => {
        let rows = [...employees.values()];
        if (where?.supervisorId)
          rows = rows.filter((e) => e.supervisorId === where.supervisorId);
        if (where?.id?.in) rows = rows.filter((e) => inIds(where.id.in)(e.id));
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
        if (where?.workDate instanceof Date) {
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
        if (where?.workDate instanceof Date) {
          rows = rows.filter(
            (a) => a.workDate.getTime() === new Date(where.workDate).getTime(),
          );
        }
        return rows.map((a) => ({ ...a }));
      },
      count: async ({ where }: any) => {
        let rows = [...attendances];
        const and = where?.AND ?? [];
        if (and.some((a: any) => a.needsReview === true))
          rows = rows.filter((a) => a.needsReview === true);
        const pred = and.find((a: any) => a.employee?.supervisorId);
        if (pred) {
          const sup = employees.get(pred.employee.supervisorId);
          rows = rows.filter((a) => {
            const emp = employees.get(a.employeeId);
            return emp?.supervisorId === sup?.id;
          });
        }
        return rows.length;
      },
    },
    leaveRequest: {
      findMany: async () => [],
      count: async ({ where }: any) => {
        let rows = [...leaves];
        if (where?.AND?.some((a: any) => a.status === 'PENDING'))
          rows = rows.filter((l) => l.status === 'PENDING');
        return rows.length;
      },
    },
    correctionRequest: {
      count: async ({ where }: any) => {
        let rows = [...corrections];
        if (where?.AND?.some((a: any) => a.status === 'PENDING'))
          rows = rows.filter((c) => c.status === 'PENDING');
        return rows.length;
      },
    },
    device: {
      count: async () => devices.filter((d) => d.status === 'PENDING').length,
    },
    auditLog: {
      findMany: async () => auditRows.map((r) => ({ ...r })),
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
        secret: 'e2e-dash',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [DashboardController],
    providers: [
      DashboardSummaryService,
      ReportsService,
      AuthService,
      {
        provide: EmailVerificationService,
        useValue: {
          issue: async () => undefined,
          verify: async () => ({ userId: 'u1' }),
        },
      },
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

describe('dashboard summary aggregate (single request)', () => {
  it('supervisor receives scoped counts; super-admin receives device and audit data', async () => {
    const server = app.getHttpServer();
    const sup = await tokenFor('u-sup', ['SUPERVISOR']);
    const sa = await tokenFor('u-sa', ['SUPER_ADMIN']);

    const res = await request(server)
      .get('/dashboard/summary?date=2026-10-05')
      .set('Authorization', `Bearer ${sup}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-10-05');
    expect(res.body.report.summary).toContainEqual(['Terjadwal', '1']);
    expect(res.body.review).toBe(1);
    expect(res.body.corrections).toBe(1);
    expect(res.body.leaves).toBe(1);
    expect(res.body.pendingDevices).toBe(0);
    expect(res.body.recentAudit).toEqual([]);
    expect(res.body.generatedAt).toBeTruthy();

    const all = await request(server)
      .get('/dashboard/summary?date=2026-10-05')
      .set('Authorization', `Bearer ${sa}`);
    expect(all.status).toBe(200);
    expect(all.body.pendingDevices).toBe(1);
    expect(all.body.recentAudit).toHaveLength(1);
    expect(all.body.review).toBe(1);

    expect(
      (await request(server).get('/dashboard/summary?date=2026-10-05')).status,
    ).toBe(401);

    // EMPLOYEE tokens are authenticated but must not reach the dashboard.
    const emp = await tokenFor('u-emp', ['EMPLOYEE']);
    expect(
      (await request(server)
        .get('/dashboard/summary?date=2026-10-05')
        .set('Authorization', `Bearer ${emp}`)).status,
    ).toBe(403);

    expect(
      (await request(server)
        .get('/dashboard/summary?date=kemarin')
        .set('Authorization', `Bearer ${sup}`)).status,
    ).toBe(400);
  });
});
