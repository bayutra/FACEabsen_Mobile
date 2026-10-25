// Users (account administration) HTTP acceptance: real HTTP through real
// guards with an in-memory Prisma double. Follows test/employees.e2e-spec.ts.
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UsersController } from '../src/users/users.controller.js';
import { UsersService } from '../src/users/users.service.js';

const ROLE_PERMS: Record<string, string[]> = {
  EMPLOYEE: ['attendance:create:self', 'attendance:read:self'],
  SUPERVISOR: ['attendance:read:team', 'report:read:team'],
  ADMIN: ['employee:read', 'user:manage'],
  SUPER_ADMIN: ['role:manage', 'security:manage'],
};
const RANK = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'];
const permsFor = (role: string) =>
  RANK.filter((r) => RANK.indexOf(r) <= RANK.indexOf(role)).flatMap(
    (r) => ROLE_PERMS[r] ?? [],
  );

function makeFake() {
  const users = new Map<string, any>();
  const employees = new Map<string, any>();
  const departments = new Map<string, any>([
    ['d1', { id: 'd1', name: 'IGD', hospitalId: 'h1' }],
    ['d2', { id: 'd2', name: 'Bedah', hospitalId: 'h2' }],
  ]);
  const sessions = new Map<string, any>();
  const audits: any[] = [];
  const userRoles: Array<{ userId: string; role: string }> = [];
  let seq = 100;

  const empOf = (u: any) =>
    [...employees.values()].find((e) => e.userId === u.id) ?? null;
  const depOf = (e: any) =>
    e?.departmentId ? (departments.get(e.departmentId) ?? null) : null;

  const containsHit = (val: unknown, q: string, mode?: string) => {
    const s = String(val ?? '');
    return mode === 'insensitive'
      ? s.toLowerCase().includes(q.toLowerCase())
      : s.includes(q);
  };

  // Honest subset of the User where-language UsersService emits: AND/OR,
  // { employee: { department: { hospitalId } } }, { employee: { is: ... } },
  // { userRoles: { some: { role: { name } } } }, contains search, isActive.
  const matchUser = (u: any, where: any): boolean => {
    if (!where || Object.keys(where).length === 0) return true;
    if (where.AND) return where.AND.every((c: any) => matchUser(u, c));
    if (where.OR) return where.OR.some((c: any) => matchUser(u, c));
    for (const [k, v] of Object.entries(where) as Array<[string, any]>) {
      if (k === 'employee' && v && typeof v === 'object') {
        const e = empOf(u);
        if ('is' in v) {
          if (v.is === null) {
            if (e !== null) return false;
          } else {
            if (!e) return false;
            for (const [ek, ev] of Object.entries(v.is) as Array<
              [string, any]
            >) {
              if (ev && typeof ev === 'object' && 'contains' in ev) {
                if (!containsHit((e as any)[ek], String(ev.contains), ev.mode))
                  return false;
              } else if ((e as any)[ek] !== ev) return false;
            }
          }
        }
        if (v.department) {
          const d = depOf(e);
          if (!d) return false;
          for (const [dk, dv] of Object.entries(v.department) as Array<
            [string, unknown]
          >) {
            if ((d as Record<string, unknown>)[dk] !== dv) return false;
          }
        }
      } else if (k === 'userRoles' && v?.some?.role?.name) {
        if (
          !userRoles.some(
            (r) => r.userId === u.id && r.role === v.some.role.name,
          )
        )
          return false;
      } else if (v && typeof v === 'object' && 'contains' in v) {
        if (!containsHit(u[k], String(v.contains), v.mode)) return false;
      } else if (u[k] !== v) return false;
    }
    return true;
  };

  const rolesOf = (userId: string) =>
    userRoles.filter((r) => r.userId === userId).map((r) => r.role);

  const projectUser = (u: any) => {
    const e = empOf(u);
    const d = depOf(e);
    return {
      id: u.id,
      email: u.email,
      isActive: u.isActive,
      failedLoginAttempts: u.failedLoginAttempts ?? 0,
      lockedUntil: u.lockedUntil ?? null,
      createdAt: u.createdAt ?? new Date(),
      userRoles: rolesOf(u.id).map((name) => ({ role: { name } })),
      employee: e
        ? {
            employeeNo: e.employeeNo,
            name: e.name,
            status: e.status,
            department: d ? { name: d.name } : null,
          }
        : null,
    };
  };

  const userApi = {
    findUnique: async ({ where }: any) => {
      const u = where.email
        ? [...users.values()].find((x) => x.email === where.email)
        : users.get(where.id);
      if (!u) return null;
      return { ...u };
    },
    findMany: async ({ where, orderBy, skip = 0, take }: any) => {
      let rows = [...users.values()]
        .filter((u) => matchUser(u, where))
        .map(projectUser);
      if (Array.isArray(orderBy)) {
        rows = [...rows].sort((a, b) => {
          for (const o of orderBy) {
            const [k, dir] = Object.entries(o)[0] as [string, string];
            const av = (a as any)[k];
            const bv = (b as any)[k];
            if (av !== bv)
              return (av > bv ? 1 : -1) * (dir === 'desc' ? -1 : 1);
          }
          return 0;
        });
      }
      return take === undefined
        ? rows.slice(skip)
        : rows.slice(skip, skip + take);
    },
    count: async ({ where }: any) =>
      [...users.values()].filter((u) => matchUser(u, where)).length,
    create: async ({ data }: any) => {
      const u = {
        id: `u${++seq}`,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        ...data,
      };
      users.set(u.id, u);
      return { ...u };
    },
    update: async ({ where, data }: any) => {
      const u = users.get(where.id);
      Object.assign(u, data);
      return { ...u };
    },
  };

  const userRoleApi = {
    findMany: async ({ where, include, select }: any) => {
      const names = rolesOf(where.userId);
      if (include?.role) {
        return names.map((name) => ({
          role: {
            name,
            ...(include.role.include?.rolePermissions
              ? {
                  rolePermissions: permsFor(name).map((key) => ({
                    permission: { key },
                  })),
                }
              : {}),
          },
        }));
      }
      if (select?.role) return names.map((name) => ({ role: { name } }));
      return names.map((name) => ({ userId: where.userId, role: name }));
    },
    create: async ({ data }: any) => {
      const rec = { userId: data.userId, role: data.roleId };
      userRoles.push(rec);
      return rec;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      for (let i = userRoles.length - 1; i >= 0; i--) {
        if (userRoles[i].userId === where.userId) {
          userRoles.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
  };

  const tx = {
    user: userApi,
    userRole: userRoleApi,
    role: {
      findUnique: async ({ where }: any) => ({
        id: `r-${where.name}`,
        name: where.name,
      }),
    },
    session: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of sessions.values()) {
          if (where.userId && s.userId !== where.userId) continue;
          if (where.revokedAt === null && s.revokedAt) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
    },
  };

  return {
    users,
    employees,
    departments,
    sessions,
    audits,
    userRoles,
    user: userApi,
    userRole: userRoleApi,
    role: tx.role,
    employee: {
      findUnique: async ({ where, include }: any) => {
        let e: any = null;
        if (where.id) e = employees.get(where.id) ?? null;
        else if ('userId' in where)
          e =
            [...employees.values()].find((x) => x.userId === where.userId) ??
            null;
        if (!e) return null;
        if (include?.department) {
          const d = depOf(e);
          return { ...e, department: d ? { hospitalId: d.hospitalId } : null };
        }
        return { ...e };
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
      updateMany: tx.session.updateMany,
    },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
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

beforeAll(async () => {
  fake = makeFake();
  const seed = [
    ['u-adm', 'admin@rs.test', ['ADMIN'], 'e-adm', 'EMP-000', 'Admin', 'd1'],
    ['u-sa', 'sa@rs.test', ['SUPER_ADMIN'], 'e-sa', 'EMP-099', 'Super', 'd1'],
    [
      'u-emp',
      'employee@rs.test',
      ['EMPLOYEE'],
      'e-emp',
      'EMP-001',
      'Karyawan',
      'd1',
    ],
    // Second-facility account: same rank as u-emp, other hospital.
    [
      'u-far',
      'far@rs.test',
      ['EMPLOYEE'],
      'e-far',
      'EMP-002',
      'Tetangga',
      'd2',
    ],
  ] as const;
  for (const [id, email, roles, eid, employeeNo, name, departmentId] of seed) {
    fake.users.set(id, {
      id,
      email,
      passwordHash: 'x',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });
    for (const r of roles) fake.userRoles.push({ userId: id, role: r });
    fake.employees.set(eid, {
      id: eid,
      userId: id,
      employeeNo,
      name,
      email,
      departmentId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });
  }

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: 'e2e-users',
        signOptions: {
          algorithm: 'HS256',
          issuer: 'face-absen',
          expiresIn: 900,
        },
      }),
    ],
    controllers: [UsersController],
    providers: [
      UsersService,
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

describe('users RBAC over HTTP', () => {
  it('EMPLOYEE gets 403 on every route; anonymous gets 401', async () => {
    const server = app.getHttpServer();
    const emp = await tokenFor('u-emp', ['EMPLOYEE'], 'employee@rs.test');
    expect(
      (
        await request(server)
          .get('/users')
          .set('Authorization', `Bearer ${emp}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .post('/users')
          .set('Authorization', `Bearer ${emp}`)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .patch('/users/u-emp')
          .set('Authorization', `Bearer ${emp}`)
          .send({})
      ).status,
    ).toBe(403);
    expect((await request(server).get('/users')).status).toBe(401);
  });
});

describe('ADMIN is blocked from account administration', () => {
  it('admin listUsers is 403 (accounts are SUPER_ADMIN-only)', async () => {
    const server = app.getHttpServer();
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const res = await request(server)
      .get('/users')
      .set('Authorization', `Bearer ${adm}`);
    expect(res.status).toBe(403);
  });

  it('admin update is 403 before any facility logic runs', async () => {
    const server = app.getHttpServer();
    const adm = await tokenFor('u-adm', ['ADMIN'], 'admin@rs.test');
    const res = await request(server)
      .patch('/users/u-far')
      .set('Authorization', `Bearer ${adm}`)
      .send({ isActive: false });
    expect(res.status).toBe(403);
    expect(fake.users.get('u-far').isActive).toBe(true);
  });
});

describe('SUPER_ADMIN is global', () => {
  it('lists every facility and can administer the far account', async () => {
    const server = app.getHttpServer();
    const sa = await tokenFor('u-sa', ['SUPER_ADMIN'], 'sa@rs.test');
    const list = await request(server)
      .get('/users')
      .set('Authorization', `Bearer ${sa}`);
    expect(list.status).toBe(200);
    const emails = (list.body.data as Array<{ email: string }>).map(
      (u) => u.email,
    );
    expect(emails).toEqual(
      expect.arrayContaining(['far@rs.test', 'admin@rs.test']),
    );
    expect(list.body.pagination.totalItems).toBe(4);

    const updated = await request(server)
      .patch('/users/u-far')
      .set('Authorization', `Bearer ${sa}`)
      .send({ isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: 'u-far', isActive: false });
    expect(fake.users.get('u-far').isActive).toBe(false);
  });
});
