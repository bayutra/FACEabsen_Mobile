// STEP 9 HTTP acceptance (PRD §54): real HTTP through real guards with an
// in-memory Prisma double. DB-backed e2e once live Postgres exists (STEP 25).
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { TemplateCryptoService } from '../src/face/crypto.service.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';
import { FaceController } from '../src/face/face.controller.js';
import { FaceService } from '../src/face/face.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const KEY = randomBytes(32).toString('base64');
const tpl = () => Array.from({ length: 192 }, (_, i) => Math.sin(i) / 2);

function makeFake() {
  const users = new Map<string, any>([['u-emp', { id: 'u-emp', email: 'e@rs.test', passwordHash: 'x', isActive: true }]]);
  const sessions = new Map<string, any>();
  const employees = new Map<string, any>([['e1', { id: 'e1', userId: 'u-emp' }]]);
  const faces = new Map<string, any>();
  const consents = new Map<string, any>([
    ['e1:BIOMETRIC_ATTENDANCE', { id: 'c1', employeeId: 'e1', purpose: 'BIOMETRIC_ATTENDANCE', version: '2026-10-01', revokedAt: null }],
  ]);
  const audits: any[] = [];
  let seq = 100;

  return {
    users, sessions, faces, audits,
    user: {
      findUnique: async ({ where, include }: any) => {
        const u = users.get(where.id) ?? null;
        if (!u) return null;
        return include?.userRoles ? { ...u, userRoles: [{ role: { name: 'EMPLOYEE' } }] } : { ...u };
      },
    },
    userRole: {
      findMany: async () => [{ role: { name: 'EMPLOYEE', rolePermissions: [] } }],
    },
    employee: {
      findUnique: async ({ where }: any) => {
        if (where.id) return employees.get(where.id) ?? null;
        if ('userId' in where) return [...employees.values()].find((e) => e.userId === where.userId) ?? null;
        return null;
      },
    },
    faceTemplate: {
      findUnique: async ({ where }: any) => faces.get(where.employeeId) ?? null,      create: async ({ data }: any) => {
        const r = { id: `f${++seq}`, version: 1, updatedAt: new Date(), ...data };
        faces.set(data.employeeId, r);
        return { ...r };
      },
      update: async ({ where, data }: any) => {
        const r = faces.get(where.employeeId);
        Object.assign(r, data);
        return { ...r };
      },
    },
    consent: {
      findUnique: async ({ where }: any) =>
        consents.get(`${where.employeeId_purpose.employeeId}:${where.employeeId_purpose.purpose}`) ?? null,
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

beforeAll(async () => {
  fake = makeFake();

  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'e2e-face', signOptions: { algorithm: 'HS256', issuer: 'face-absen', expiresIn: 900 } })],
    controllers: [FaceController],
    providers: [
      FaceService,
      TemplateCryptoService,
      PrivacyService,
      AuthService,
      JwtAuthGuard,
      RolesGuard,
      PermissionsGuard,
      { provide: PrismaService, useValue: fake },
      { provide: ConfigService, useValue: { get: (k: string, d: unknown) => (k === 'DATA_ENCRYPTION_KEY' ? KEY : d) } },
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

describe('face registration over HTTP (PRD §54)', () => {
  it('valid face registers (v1), re-registers (v2), status hides bytes', async () => {
    const server = app.getHttpServer();
    const s = await fake.session.create({
      data: { userId: 'u-emp', refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const token = await jwt.signAsync({ sub: 'u-emp', email: 'e@rs.test', roles: ['EMPLOYEE'], sid: s.id });
    const auth = { Authorization: `Bearer ${token}` };

    const st0 = await request(server).get('/face/status').set(auth);
    expect(st0.body).toEqual({ registered: false });

    const r1 = await request(server).post('/face/register').set(auth).send({ template: tpl(), qualityScore: 0.9 });
    expect(r1.status).toBe(200);
    expect(r1.body.version).toBe(1);

    const r2 = await request(server).post('/face/register').set(auth).send({ template: tpl(), qualityScore: 0.8 });
    expect(r2.body.version).toBe(2);

    const st = await request(server).get('/face/status').set(auth);
    expect(st.body.registered).toBe(true);
    expect(st.body).not.toHaveProperty('templateCipher');

    const actions = fake.audits.map((a: any) => a.action);
    expect(actions).toEqual(['FACE_REGISTERED', 'FACE_UPDATED']);
  });

  it('rejects: blur-equivalent low quality, wrong dims, anon', async () => {
    const server = app.getHttpServer();
    const s = await fake.session.create({
      data: { userId: 'u-emp', refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const token = await jwt.signAsync({ sub: 'u-emp', email: 'e@rs.test', roles: ['EMPLOYEE'], sid: s.id });
    const auth = { Authorization: `Bearer ${token}` };

    expect((await request(server).post('/face/register').set(auth).send({ template: tpl(), qualityScore: 0.2 })).status).toBe(400);
    expect((await request(server).post('/face/register').set(auth).send({ template: tpl().slice(0, 100), qualityScore: 0.9 })).status).toBe(400);
    expect((await request(server).post('/face/register').send({ template: tpl(), qualityScore: 0.9 })).status).toBe(401);
  });
});
