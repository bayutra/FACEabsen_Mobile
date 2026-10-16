// STEP 11 HTTP acceptance (PRD §56): real HTTP through real guards with an
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
import { GeoController } from '../src/geo/geo.controller.js';
import { GeoService } from '../src/geo/geo.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function makeFake() {
  const users = new Map<string, any>([['u-emp', { id: 'u-emp', email: 'e@rs.test', passwordHash: 'x', isActive: true }]]);
  const sessions = new Map<string, any>();
  const hospitals = new Map<string, any>([
    ['h1', { id: 'h1', code: 'RS-A', name: 'RS Contoh', latitude: -7.65, longitude: 112.23, radiusMeters: 100 }],
    ['h2', { id: 'h2', code: 'RS-B', name: 'RS Tetangga', latitude: -7.0, longitude: 112.0, radiusMeters: 100 }],
  ]);
  const employees = new Map<string, any>([['e1', { id: 'e1', userId: 'u-emp', department: { hospital: hospitals.get('h1') } }]]);
  let seq = 100;

  return {
    users, sessions,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = users.get(where.id) ?? null;
        if (!u) return null;
        return include?.userRoles ? { ...u, userRoles: [{ role: { name: 'EMPLOYEE' } }] } : { ...u };
      },
    },
    userRole: { findMany: async () => [{ role: { name: 'EMPLOYEE', rolePermissions: [] } }] },
    employee: {
      findUnique: async ({ where }: any) => {
        if (where.id) return employees.get(where.id) ?? null;
        if ('userId' in where) return [...employees.values()].find((e) => e.userId === where.userId) ?? null;
        return null;
      },
    },
    hospital: { findUnique: async ({ where }: any) => hospitals.get(where.id) ?? null },
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
let token = '';

beforeAll(async () => {
  fake = makeFake();

  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'e2e-geo', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [GeoController],
    providers: [
      GeoService,
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
  const s = await fake.session.create({
    data: { userId: 'u-emp', refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 86_400_000) },
  });
  token = await jwt.signAsync({ sub: 'u-emp', email: 'e@rs.test', roles: ['EMPLOYEE'], sid: s.id });
});

afterAll(async () => {
  await app?.close();
});

describe('POST /geo/check', () => {
  const fix = (over: Record<string, unknown> = {}) => ({
    latitude: -7.65,
    longitude: 112.23,
    accuracyM: 10,
    timestamp: new Date().toISOString(),
    isMocked: false,
    ...over,
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('inside courtyard, outside lot, mocked, stale', async () => {
    const server = app.getHttpServer();
    const ok = await request(server).post('/geo/check').set(auth()).send(fix());
    expect(ok.status).toBe(200);
    expect(ok.body.inside).toBe(true);
    expect(ok.body.hospital).toMatchObject({ code: 'RS-A' });

    const out = await request(server).post('/geo/check').set(auth()).send(fix({ latitude: -7.6482 }));
    expect(out.body.inside).toBe(false);
    expect(out.body.distanceM).toBeGreaterThan(150);

    const mock = await request(server).post('/geo/check').set(auth()).send(fix({ isMocked: true }));
    expect(mock.body).toMatchObject({ inside: false, mockSuspected: true });

    const stale = await request(server)
      .post('/geo/check')
      .set(auth())
      .send(fix({ timestamp: new Date(Date.now() - 30 * 60_000).toISOString() }));
    expect(stale.body.checks.timestampFresh).toBe(false);
  });

  it('validation 400, anon 401', async () => {
    const server = app.getHttpServer();
    expect((await request(server).post('/geo/check').set(auth()).send(fix({ latitude: 200 }))).status).toBe(400);
    expect((await request(server).post('/geo/check').send(fix())).status).toBe(401);
  });

  // M4 — a non-SUPER_ADMIN caller cannot pull another facility's fence by
  // passing its id: the override is ignored, own hospital is resolved.
  it('non-admin hospitalId override is ignored', async () => {
    const server = app.getHttpServer();
    const res = await request(server).post('/geo/check').set(auth()).send(fix({ hospitalId: 'h2' }));
    expect(res.status).toBe(200);
    expect(res.body.inside).toBe(true);
    expect(res.body.hospital).toMatchObject({ code: 'RS-A' });
  });
});
