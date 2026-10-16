// Farm cleanup — revoke device uji + hapus data biometrik uji. Audit retained.
// Usage: node backend/scripts/farm-cleanup.mjs --dry-run
//        node backend/scripts/farm-cleanup.mjs --apply --match "@rs.test|demo|EMP-00"
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const apply = args.includes('--apply');
const matchArg = args.includes('--match') ? args[args.indexOf('--match') + 1] : '@rs.test|demo|EMP-00';
if (!dry && !apply) {
  console.error('pilih --dry-run atau --apply --match "<regex>"');
  process.exit(1);
}
let re;
try {
  re = new RegExp(matchArg, 'i');
} catch {
  console.error('--match harus regex valid');
  process.exit(1);
}

const prisma = new PrismaClient();
const employees = await prisma.employee.findMany({ select: { id: true, email: true, employeeNo: true, name: true } });
const targets = employees.filter((e) => re.test(e.email) || re.test(e.employeeNo) || re.test(e.name));
const ids = targets.map((t) => t.id);
console.log(`kandidat uji: ${targets.length} employee cocok /${matchArg}/`);
for (const t of targets.slice(0, 20)) console.log(`- ${t.employeeNo} ${t.email}`);
if (targets.length > 20) console.log(`... +${targets.length - 20} lainnya`);

const counts = {
  devices: ids.length ? await prisma.device.count({ where: { employeeId: { in: ids } } }) : 0,
  faceTemplates: ids.length ? await prisma.faceTemplate.count({ where: { employeeId: { in: ids } } }) : 0,
  consents: ids.length ? await prisma.consent.count({ where: { employeeId: { in: ids } } }) : 0,
  schedules: ids.length ? await prisma.employeeSchedule.count({ where: { employeeId: { in: ids } } }) : 0,
};
console.log(`akan dibersihkan: ${JSON.stringify(counts)} (attendance/audit TIDAK disentuh)`);

if (dry || ids.length === 0) {
  console.log(dry ? 'dry-run selesai (tidak ada perubahan).' : 'tidak ada target.');
  await prisma.$disconnect();
  process.exit(0);
}

const revoked = await prisma.device.updateMany({ where: { employeeId: { in: ids }, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'farm-cleanup-go-live' } });
const delFaces = await prisma.faceTemplate.deleteMany({ where: { employeeId: { in: ids } } });
const delConsents = await prisma.consent.deleteMany({ where: { employeeId: { in: ids } } });
const delSched = await prisma.employeeSchedule.deleteMany({ where: { employeeId: { in: ids } } });
console.log(`farm-cleanup ok: devices revoked=${revoked.count}, faces=${delFaces.count}, consents=${delConsents.count}, schedules=${delSched.count}`);
await prisma.$disconnect();
