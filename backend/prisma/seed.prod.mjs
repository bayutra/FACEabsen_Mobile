// Production seed — IDEMPOTEN, TANPA user demo.
// Membuat: roles (4) + permissions + rolePermissions + SATU bootstrap admin.
// Kredensial dari env: BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD.
// Setelah sukses: KOSONGKAN BOOTSTRAP_ADMIN_PASSWORD dari .env.production.
// Run: BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... npx prisma db seed
// (package.json prisma.seed menunjuk ke seed.mjs untuk dev; prod panggil file ini langsung:
//  node prisma/seed.prod.mjs)
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const ROLE_PERMISSIONS = {
  EMPLOYEE: ['attendance:create:self', 'attendance:read:self', 'correction:create:self', 'leave:create:self'],
  SUPERVISOR: ['attendance:read:team', 'attendance:approve:team', 'correction:approve:team', 'leave:approve:team', 'report:read:team'],
  ADMIN: ['employee:create', 'employee:update', 'employee:read', 'attendance:read', 'device:read', 'device:revoke', 'device:approve-replacement', 'shift:manage', 'schedule:manage', 'report:read', 'audit:read'],
  SUPER_ADMIN: ['user:manage', 'role:manage', 'security:manage', 'system:manage'],
};
const RANK = { EMPLOYEE: 1, SUPERVISOR: 2, ADMIN: 3, SUPER_ADMIN: 4 };
const effective = (role) => Object.keys(ROLE_PERMISSIONS).flatMap((r) => (RANK[r] <= RANK[role] ? ROLE_PERMISSIONS[r] : []));

const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('BOOTSTRAP_ADMIN_EMAIL wajib diisi dengan email valid');
  process.exit(1);
}
if (!password || password.length < 12 || /CHANGE-ME/i.test(password)) {
  console.error('BOOTSTRAP_ADMIN_PASSWORD wajib ≥12 karakter acak (bukan placeholder)');
  process.exit(1);
}

const prisma = new PrismaClient();
const allPerms = [...new Set(Object.values(ROLE_PERMISSIONS).flat())];
for (const key of allPerms) {
  await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
}
for (const role of Object.keys(ROLE_PERMISSIONS)) {
  const r = await prisma.role.upsert({ where: { name: role }, update: {}, create: { name: role } });
  for (const key of effective(role)) {
    const p = await prisma.permission.findUniqueOrThrow({ where: { key } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: r.id, permissionId: p.id } },
      update: {},
      create: { roleId: r.id, permissionId: p.id },
    });
  }
}

// Bootstrap admin: user + SUPER_ADMIN role. Tidak membuat employee/demo.
const hash = await argon2.hash(password);
const user = await prisma.user.upsert({
  where: { email },
  update: {},
  create: { email, passwordHash: hash },
});
const superRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
await prisma.userRole.upsert({
  where: { userId_roleId: { userId: user.id, roleId: superRole.id } },
  update: {},
  create: { userId: user.id, roleId: superRole.id },
});

// Verify counts (fail-closed signal for db-go-live.sh).
const [roles, perms, admins] = await Promise.all([
  prisma.role.count(),
  prisma.permission.count(),
  prisma.userRole.count({ where: { roleId: superRole.id } }),
]);
console.log(`seed.prod ok: ${roles} roles, ${perms} permissions, ${admins} super_admin(s), bootstrap=${email}`);
await prisma.$disconnect();
