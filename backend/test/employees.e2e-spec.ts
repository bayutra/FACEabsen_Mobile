// STEP 5 HTTP acceptance (PRD §50): real HTTP through real guards with an
// in-memory Prisma double. DB-backed e2e runs once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { EmployeesController } from '../src/employees/employees.controller.js';
import { DepartmentsController } from '../src/employees/departments.controller.js';
import { EmployeesService } from '../src/employees/employees.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self', 'attendance:read:self'],
  SUPERVISOR: ['attendance:read:team', 'report:read:team'],
  ADMIN: ['employee:create', 'employee:read', 'employee:update', 'device:read', 'audit:read'],
  SUPER_ADMIN: ['role:manage', 'security:manage'],
};
const RANK = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'];
const permsFor = (role: string) =>
  RANK.filter((r) => RANK.indexOf(r) <= RANK.indexOf(role)).flatMap((r) => ROLE_PERMS[r] ?? []);

function makeFake() {
  const users = new Map<string, any>();
  const employees = new Map<string, any>();
  const departments = new Map<string, any>([['d1', { id: 'd1', name: 'IGD', hospitalId: 'h1' }]]);
  const sessions = new Map<string, any>();
  const audits: any[] = [];
  const userRoles: Array<{ userId: string; role: string }> = [];
  let seq = 100;

  const withRoles = (u: any, include: any) =>
    include?.userRoles
      ? { ...u, userRoles: userRoles.filter((r) => r.userId === u.id).map((r) => ({ role: { name: r.role } })) }
      : { ...u };

  const withIncludes = (e: any, include: any) => {
    if (!e) return null;
    const out: any = { ...e };
    if (include?.department) out.department = e.departmentId ? departments.get(e.departmentId) ?? null : null;
    if (include?.supervisor) {
      const s = e.supervisorId ? employees.get(e.supervisorId) : null;
      out.supervisor = s ? { id: s.id, name: s.name, employeeNo: s.employeeNo } : null;
    }
    if (include?.user) {
      const u = e.userId ? users.get(e.userId) : null;
      out.user = u ? { id: u.id, email: u.email, isActive: u.isActive } : null;
    }
    return out;
  };

  const matchWhere = (e: any, where: any): boolean => {
    if (!where || Object.keys(where).length === 0) return true;
    if (where.AND) return where.AND.every((c: any) => matchWhere(e, c));
    if (where.OR) return where.OR.some((c: any) => matchWhere(e, c));
    for (const [k, v] of Object.entries(where) as Array<[string, any]>) {
      if (v && typeof v === 'object' && 'contains' in v) {
        const val = String(e[k] ?? '');
        const q = String(v.contains);
        const hit = v.mode === 'insensitive' ? val.toLowerCase().includes(q.toLowerCase()) : val.includes(q);
        if (!hit) return false;
      } else if (k === 'department' && v && typeof v === 'object') {
        // Tahap 2 tenant scoping: resolve the employee's facility for nested
        // { department: { hospitalId } } predicates.
        const d = e.departmentId ? departments.get(e.departmentId) ?? null : null;
        if (!d) return false;
        for (const [dk, dv] of Object.entries(v) as Array<[string, unknown]>) {
          if ((d as Record<string, unknown>)[dk] !== dv) return false;
        }
      } else if (e[k] !== v) return false;
    }
    return true;
  };

  return {
    users, employees, sessions, audits, userRoles,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = where.email
          ? [...users.values()].find((x) => x.email === where.email)
          : users.get(where.id);
        return u ? withRoles(u, include) : null;
      },
      create: async ({ data }: any) => {
        const u = { id: `u${++seq}`, isActive: true, failedLoginAttempts: 0, lockedUntil: null, ...data };
        users.set(u.id, u);
        return { ...u };
      },
      update: async ({ where, data }: any) => {
        const u = users.get(where.id);
        Object.assign(u, data);
        return { ...u };
      },
    },
    userRole: {
      findMany: async ({ where, include }: any) => {
        const roles = userRoles.filter((r) => r.userId === where.userId).map((r) => r.role);
        if (include?.role?.include?.rolePermissions) {
          return roles.map((r) => ({
            role: { name: r, rolePermissions: permsFor(r).map((key) => ({ permission: { key } })) },
          }));
        }
        if (include?.role) return roles.map((r) => ({ role: { name: r } }));
        return roles.map((r) => ({ userId: where.userId, role: r }));
      },
      create: async ({ data }: any) => {
        const rec = { userId: data.userId, role: data.roleId };
        userRoles.push(rec);
        return rec;
      },
    },
    role: {
      // fake stores role NAME as id for simplicity
      findUnique: async ({ where }: any) => ({ id: where.name, name: where.name }),
    },
    employee: {
      findUnique: async ({ where, include }: any) => {
        let e = null;
        if (where.id) e = employees.get(where.id) ?? null;
        else if (where.employeeNo) e = [...employees.values()].find((x) => x.employeeNo === where.employeeNo) ?? null;
        else if ('userId' in where) e = [...employees.values()].find((x) => x.userId === where.userId) ?? null;
        return withIncludes(e, include);
      },
      findMany: async ({ where, skip = 0, take, include }: any) => {
        const rows = [...employees.values()].filter((e) => matchWhere(e, where)).map((e) => withIncludes(e, include));
        return (take === undefined ? rows.slice(skip) : rows.slice(skip, skip + take)).map((e) => ({ ...e }));
      },
      count: async ({ where }: any) => [...employees.values()].filter((e) => matchWhere(e, where)).length,
      create: async ({ data }: any) => {
        const e = { id: `e${++seq}`, status: 'ACTIVE', createdAt: new Date(), ...data };
        employees.set(e.id, e);
        return { ...e };
      },
      update: async ({ where, data }: any) => {
        const e = employees.get(where.id);
        Object.assign(e, data);
        return { ...e };
      },
    },
    department: {
      findUnique: async ({ where }: any) => departments.get(where.id) ?? null,
      findMany: async ({ where }: any) => {
        let rows = [...departments.values()];
        if (where?.hospitalId) rows = rows.filter((d) => d.hospitalId === where.hospitalId);
        return rows
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((d) => ({ ...d, hospital: { id: d.hospitalId, code: 'RS-A', name: 'RS Contoh' } }));
      },
    },
    session: {
      create: async ({ data }: any) => {
        const s = { id: `s${++seq}`, createdAt: new Date(), revokedAt: null, ...data };
        sessions.set(s.id, s);
        return { ...s };
      },
      findUnique: async ({ where, include }: any) => {
        const s = where.id
          ? sessions.get(where.id) ?? null
          : ([...sessions.values()].find((x) => x.refreshTokenHash === where.refreshTokenHash) ?? null);
        if (!s) return null;
        if (include?.user) {
          const u = users.get(s.userId);
          return { ...s, user: withRoles(u, include.user.include) };
        }
        return { ...s };
      },
      findMany: async () => [...sessions.values()].map((s) => ({ ...s })),
      update: async ({ where, data }: any) => {
        const s = sessions.get(where.id);
        Object.assign(s, data);
        return { ...s };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of sessions.values()) {
          if (where.userId && s.userId !== where.userId) continue;
          if (where.id && s.id !== where.id) continue;
          if (where.NOT?.id && s.id === where.NOT.id) continue;
          if (where.revokedAt === null && s.revokedAt) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
    },
    device: { findUnique: async () => null },
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
  const hash = await argon2.hash('Password123!');
  const seed = [
    ['u-adm', 'admin@rs.test', ['ADMIN']],
    ['u-sup', 'supervisor@rs.test', ['SUPERVISOR']],
    ['u-emp', 'employee@rs.test', ['EMPLOYEE']],
  ] as const;
  for (const [id, email, roles] of seed) {
    fake.users.set(id, {
      id, email, passwordHash: hash, isActive: true, failedLoginAttempts: 0, lockedUntil: null,
    });
    for (const r of roles) fake.userRoles.push({ userId: id, role: r });
  }
  fake.employees.set('e-emp', {
    id: 'e-emp', userId: 'u-emp', employeeNo: 'EMP-001', name: 'Karyawan',
    email: 'employee@rs.test', departmentId: 'd1', status: 'ACTIVE', createdAt: new Date(),
  });
  // Tahap 2 tenant scoping: the ADMIN actor belongs to the same facility as
  // every fixture below (mirrors prisma/seed.mjs, where all demo users have
  // employee rows). A facility-less admin would correctly see nothing.
  fake.employees.set('e-adm', {
    id: 'e-adm', userId: 'u-adm', employeeNo: 'EMP-000', name: 'Admin',
    email: 'admin@rs.test', departmentId: 'd1', status: 'ACTIVE', createdAt: new Date(),
  });

  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'e2e-emp', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [EmployeesController, DepartmentsController],
    providers: [
      EmployeesService,
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

describe('RBAC on employees (PRD §50)', () => {
  it('EMPLOYEE and SUPERVISOR get 403 on every admin route', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    const sup = await tokenFor('u-sup', ['SUPERVISOR'], 'supervisor@rs.test');
    for (const t of [emp, sup]) {
      expect((await request(server).get('/employees').set('Authorization', `Bearer ${t}`)).status).toBe(403);
      expect((await request(server).post('/employees').set('Authorization', `Bearer ${t}`).send({})).status).toBe(403);
      expect((await request(server).patch('/employees/e-emp').set('Authorization', `Bearer ${t}`).send({ name: 'x' })).status).toBe(403);
      expect((await request(server).post('/employees/e-emp/deactivate').set('Authorization', `Bearer ${t}`)).status).toBe(403);
    }
  });

  it('anonymous gets 401', async () => {
    expect((await request(app.getHttpServer()).get('/employees')).status).toBe(401);
  });
});

describe('employee CRUD as ADMIN', () => {
  const dto = {
    employeeNo: 'EMP-010',
    name: 'Dokter Baru',
    email: 'dokter@rs.test',
    position: 'Dokter',
    departmentId: 'd1',
    password: 'Password123!',
  };
  let admin = '';

  it('create -> read -> list -> update', async () => {
    const server = app.getHttpServer();
    admin = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');

    const created = await request(server).post('/employees').set('Authorization', `Bearer ${admin}`).send(dto);
    expect(created.status).toBe(201);
    expect(created.body.employeeNo).toBe('EMP-010');
    expect(created.body.roles).toContain('EMPLOYEE');
    expect(created.body).not.toHaveProperty('passwordHash');
    const id = created.body.id as string;

    const got = await request(server).get(`/employees/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(got.status).toBe(200);
    expect(got.body.department).toMatchObject({ id: 'd1', name: 'IGD' });

    const listed = await request(server).get('/employees?search=dokter').set('Authorization', `Bearer ${admin}`);
    expect(listed.status).toBe(200);
    expect(listed.body.pagination.totalItems).toBe(1);
    expect(listed.body.data).toHaveLength(1);

    const updated = await request(server).patch(`/employees/${id}`).set('Authorization', `Bearer ${admin}`).send({ position: 'Dokter Senior' });
    expect(updated.status).toBe(200);
    expect(updated.body.position).toBe('Dokter Senior');

    const actions = fake.audits.map((a) => a.action);
    expect(actions).toContain('EMPLOYEE_CREATED');
    expect(actions).toContain('EMPLOYEE_UPDATED');
  });

  it('validation 400, duplicate 409, unknown dept 404, forbidden grant 403', async () => {
    const server = app.getHttpServer();
    const bad = await request(server).post('/employees').set('Authorization', `Bearer ${admin}`).send({ ...dto, email: 'nope' });
    expect(bad.status).toBe(400);
    const dup = await request(server).post('/employees').set('Authorization', `Bearer ${admin}`).send({ ...dto, employeeNo: 'EMP-011' });
    expect(dup.status).toBe(409);
    const dept = await request(server).post('/employees').set('Authorization', `Bearer ${admin}`).send({ ...dto, employeeNo: 'EMP-012', email: 'x@rs.test', departmentId: 'dx' });
    expect(dept.status).toBe(404);
    const grant = await request(server).post('/employees').set('Authorization', `Bearer ${admin}`).send({ ...dto, employeeNo: 'EMP-013', email: 'y@rs.test', roles: ['ADMIN'] });
    expect(grant.status).toBe(403);
  });

  it('deactivate preserves the record but kills the login', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/employees').set('Authorization', `Bearer ${admin}`).send({ ...dto, employeeNo: 'EMP-020', email: 'out@rs.test' });
    const id = created.body.id as string;

    const off = await request(server).post(`/employees/${id}/deactivate`).set('Authorization', `Bearer ${admin}`);
    expect(off.status).toBe(200);
    expect(off.body.status).toBe('INACTIVE');

    // record still readable (history preserved, not deleted)
    const still = await request(server).get(`/employees/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(still.status).toBe(200);

    // but the login is dead: account flagged inactive (full login-kill proven in unit spec)
    const buried = [...fake.users.values()].find((x) => x.email === 'out@rs.test');
    expect(buried.isActive).toBe(false);
    expect(fake.audits.map((a) => a.action)).toContain('EMPLOYEE_DEACTIVATED');
  });

  it('self profile via /employees/me', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    const me = await request(server).get('/employees/me').set('Authorization', `Bearer ${emp}`);
    expect(me.status).toBe(200);
    expect(me.body.employeeNo).toBe('EMP-001');
  });
});

describe('departments lookup (STEP 14 filter support)', () => {
  it('admin lists, employee denied, anon denied', async () => {
    const server = app.getHttpServer();
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');

    const all = await request(server).get('/departments').set('Authorization', `Bearer ${adm}`);
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(1);
    expect(all.body[0]).toMatchObject({ id: 'd1', name: 'IGD' });

    expect((await request(server).get('/departments').set('Authorization', `Bearer ${emp}`)).status).toBe(403);
    expect((await request(server).get('/departments')).status).toBe(401);
  });
});

describe('injection attempts (PRD §69)', () => {
  it('SQL strings in search are inert literals (no crash, no dump)', async () => {
    const server = app.getHttpServer();
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    for (const search of [`' OR '1'='1`, `'; DROP TABLE employees; --`, '%']) {
      const r = await request(server).get(`/employees?search=${encodeURIComponent(search)}`).set('Authorization', `Bearer ${adm}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.data)).toBe(true);
      expect(JSON.stringify(r.body)).not.toContain('passwordHash');
    }
  });
});
