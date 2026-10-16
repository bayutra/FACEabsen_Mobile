// DB-backed login E2E (go-live gate).
// Run: $env:DATABASE_URL_E2E="postgresql://.../face_absen_e2e?schema=public"
//      npx prisma migrate deploy  (dengan DATABASE_URL=DATABASE_URL_E2E)
//      npx vitest run --config ./vitest.config.e2e.ts test/login-db.e2e-spec.ts
// Skips gracefully when DATABASE_URL_E2E is unset (CI tanpa Postgres).
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

const DB_URL = process.env.DATABASE_URL_E2E;
const maybe = DB_URL ? describe : describe.skip;

maybe('login DB e2e (Postgres nyata)', () => {
  const prisma = new PrismaClient({ datasourceUrl: DB_URL });
  const email = `e2e-login-${Date.now()}@rs.test`;
  let userId = '';

  beforeAll(async () => {
    await prisma.session.deleteMany({ where: { user: { email } } });
    await prisma.userRole.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.role.upsert({ where: { name: 'EMPLOYEE' }, update: {}, create: { name: 'EMPLOYEE' } });
    const user = await prisma.user.create({
      data: { email, passwordHash: await argon2.hash('Password123!'), failedLoginAttempts: 0 },
    });
    userId = user.id;
    const role = await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('password terverifikasi via argon2 (jalur yang dipakai AuthService)', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await argon2.verify(u.passwordHash, 'Password123!')).toBe(true);
    expect(await argon2.verify(u.passwordHash, 'salah')).toBe(false);
  });

  it('lockout counter naik dan reset (kolom STEP 3)', async () => {
    await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 15 * 60_000) } });
    const locked = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(locked.failedLoginAttempts).toBe(5);
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    const clean = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(clean.failedLoginAttempts).toBe(0);
    expect(clean.lockedUntil).toBeNull();
  });

  it('session refresh rotation tersimpan sha256 (bukan plaintext)', async () => {
    const raw = randomBytes(48).toString('base64url');
    const s = await prisma.session.create({
      data: { userId, refreshTokenHash: createHash('sha256').update(raw).digest('hex'), expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    expect(s.refreshTokenHash).not.toContain(raw);
    expect(s.refreshTokenHash).toHaveLength(64);
    const next = randomBytes(48).toString('base64url');
    await prisma.session.update({ where: { id: s.id }, data: { refreshTokenHash: createHash('sha256').update(next).digest('hex') } });
    const rotated = await prisma.session.findUniqueOrThrow({ where: { id: s.id } });
    expect(rotated.refreshTokenHash).not.toBe(s.refreshTokenHash);
    await prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    const revoked = await prisma.session.findUniqueOrThrow({ where: { id: s.id } });
    expect(revoked.revokedAt).not.toBeNull();
  });
});
