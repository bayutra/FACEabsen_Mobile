/**
 * Migrasi kebijakan perangkat: "1 karyawan = 1 perangkat ACTIVE" sudah dihapus.
 *
 * Perangkat yang sebelumnya berstatus PENDING (menunggu aktivasi admin karena
 * akun sudah punya perangkat ACTIVE) kini tidak lagi perlu antre — perangkat
 * baru langsung ACTIVE saat registrasi. Skrip ini mengaktifkan sisa perangkat
 * PENDING lama agar pengguna tidak terjebak di status "menunggu aktivasi".
 *
 * Jalankan sekali setelah deploy: `node scripts/activate-pending-devices.mjs`
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const pending = await prisma.device.findMany({
  where: { status: 'PENDING' },
  select: { id: true, employeeId: true, deviceName: true },
});

if (pending.length === 0) {
  console.log('Tidak ada perangkat PENDING. Tidak ada yang diubah.');
} else {
  await prisma.device.updateMany({
    where: { id: { in: pending.map((d) => d.id) } },
    data: { status: 'ACTIVE' },
  });
  console.log(`Diaktifkan ${pending.length} perangkat PENDING:`);
  for (const d of pending) {
    console.log(`- ${d.id} (${d.deviceName ?? 'tanpa nama'}) employee=${d.employeeId}`);
  }
}

const active = await prisma.device.count({ where: { status: 'ACTIVE' } });
console.log(`Total perangkat ACTIVE sekarang: ${active}`);
await prisma.$disconnect();
