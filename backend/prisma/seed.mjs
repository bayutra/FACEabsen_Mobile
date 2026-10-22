// STEP 3 — dev seed: roles, permissions, demo users (one per role).
// Requires live DATABASE_URL. Run: npx prisma db seed
// Password for all demo users: Password123!
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const ROLE_PERMISSIONS = {
  EMPLOYEE: [
    'attendance:create:self',
    'attendance:read:self',
    'correction:create:self',
    'leave:create:self',
    'handover:create:self',
    'handover:read:self',
  ],
  SUPERVISOR: [
    'attendance:read:team',
    'attendance:approve:team',
    'correction:approve:team',
    'leave:approve:team',
    'report:read:team',
    // SDM terbatas: service layer membatasi ke unit/tim sendiri.
    'employee:read',
    'employee:update',
    'handover:read:team',
    'handover:acknowledge:team',
  ],
  ADMIN: [
    'employee:create',
    'employee:update',
    'employee:read',
    'attendance:read',
    'department:manage',
    'device:read',
    'device:revoke',
    'device:approve-replacement',
    'shift:manage',
    'schedule:manage',
    'report:read',
    'audit:read',
    // Account provisioning is SUPER_ADMIN-only (backend /users guards);
    // ADMIN stops at staff records. 'user:manage' is intentionally absent.
  ],
  SUPER_ADMIN: ['role:manage', 'security:manage', 'system:manage'],
};
const RANK = { EMPLOYEE: 1, SUPERVISOR: 2, ADMIN: 3, SUPER_ADMIN: 4 };
const effective = (role) =>
  Object.keys(ROLE_PERMISSIONS).flatMap((r) =>
    RANK[r] <= RANK[role] ? ROLE_PERMISSIONS[r] : [],
  );

const prisma = new PrismaClient();

const hospital = await prisma.hospital.upsert({
  where: { code: 'RS-A' },
  update: {},
  create: {
    code: 'RS-A', name: 'RSU Darmayu Madiun',
  },
});
const dept = await prisma.department.upsert({
  where: { hospitalId_name: { hospitalId: hospital.id, name: 'IGD' } },
  update: {},
  create: { hospitalId: hospital.id, name: 'IGD' },
});

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

const demos = [
  { email: 'employee@rs.test', role: 'EMPLOYEE', no: 'EMP-001', name: 'Karyawan Demo' },
  { email: 'supervisor@rs.test', role: 'SUPERVISOR', no: 'EMP-002', name: 'Supervisor Demo' },
  { email: 'admin@rs.test', role: 'ADMIN', no: 'EMP-003', name: 'Admin Demo' },
  { email: 'superadmin@rs.test', role: 'SUPER_ADMIN', no: 'EMP-004', name: 'Super Admin Demo' },
];
const hash = await argon2.hash('Password123!');
for (const d of demos) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: d.role } });
  const user = await prisma.user.upsert({
    where: { email: d.email },
    update: {},
    create: { email: d.email, passwordHash: hash },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  await prisma.employee.upsert({
    where: { employeeNo: d.no },
    update: {},
    create: {
      userId: user.id, employeeNo: d.no, name: d.name, email: d.email, departmentId: dept.id,
    },
  });
}
// supervisor relation: EMP-002 supervises EMP-001
const sup = await prisma.employee.findUniqueOrThrow({ where: { employeeNo: 'EMP-002' } });
await prisma.employee.updateMany({
  where: { employeeNo: 'EMP-001' },
  data: { supervisorId: sup.id },
});

console.log('seed ok: 4 roles,', allPerms.length, 'permissions, 4 demo users');
await prisma.$disconnect();
