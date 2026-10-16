import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { Clock, MoonStar, Sun } from 'lucide-react';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { loadHospitals } from '@/lib/master-data';
import { formatWindow, type ShiftItem } from '@/lib/shifts';
import { Badge, EmptyRow, TableShell, Td, Th, Tr } from '@/components/ui/surface';
import { ShiftCreateForm } from './shift-create-form';
import { ShiftRowActions } from './shift-row-actions';

// STEP 6 — shifts master data. Reads need `employee:read`; writes need
// `shift:manage` (ADMIN, and SUPER_ADMIN by rank inheritance).
export default async function ShiftsPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const [res, hospitals] = await Promise.all([
    fetch(`${backendUrl()}/shifts`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    loadHospitals(backendUrl(), token),
  ]);

  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat data shift');

  const shifts = (await res.json()) as ShiftItem[];

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Master Data
            <span className="text-primary">/ Master Shift</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Pengaturan Shift Jaga</h1>
          <p className="text-body-sm text-outline">
            Jendela waktu, toleransi keterlambatan, dan ambang penandaan terlambat.
          </p>
        </div>
        <ShiftCreateForm hospitals={hospitals} />
      </div>

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-3">
        {shifts.map((s) => (
          <section
            key={s.id}
            className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
                {s.overnight ? (
                  <MoonStar size={18} className="text-primary" aria-hidden />
                ) : (
                  <Sun size={18} className="text-primary" aria-hidden />
                )}
                {s.name}
              </h2>
              {s.overnight ? <Badge tone="info">Malam</Badge> : <Badge tone="success">Pagi</Badge>}
            </div>
            {/* Tabular figures: shift windows must line up across the grid. */}
            <p className="tabular mt-2 text-headline-md text-primary">{formatWindow(s)}</p>
            <p className="mt-1 text-label-sm text-outline">{s.hospital?.name ?? ''}</p>
            <dl className="mt-space-md flex gap-space-md border-t border-outline-variant/30 pt-space-sm text-body-sm">
              <div>
                <dt className="text-label-sm text-outline">Toleransi</dt>
                <dd className="tabular font-medium text-on-surface">{s.gracePeriodMin} mnt</dd>
              </div>
              <div>
                <dt className="text-label-sm text-outline">Ambang telat</dt>
                <dd className="tabular font-medium text-on-surface">{s.lateThresholdMin} mnt</dd>
              </div>
            </dl>
            <div className="mt-auto pt-space-md">
              <ShiftRowActions
                id={s.id}
                name={s.name}
                startTime={s.startTime}
                endTime={s.endTime}
                gracePeriodMin={s.gracePeriodMin}
                lateThresholdMin={s.lateThresholdMin}
                earlyCheckoutThresholdMin={s.earlyCheckoutThresholdMin}
              />
            </div>
          </section>
        ))}
      </div>

      <TableShell>
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Nama Shift</Th>
              <Th>Jendela</Th>
              <Th>Fasilitas</Th>
              <Th align="right">Toleransi</Th>
              <Th align="right">Ambang Telat</Th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <span className="flex items-center gap-2 font-medium">
                    <Clock size={15} className="text-primary" aria-hidden />
                    {s.name}
                  </span>
                  {s.overnight ? <Badge tone="info" className="mt-1">Malam</Badge> : null}
                </Td>
                <Td tabular>{formatWindow(s)}</Td>
                <Td>{s.hospital?.name ?? '—'}</Td>
                <Td tabular align="right">
                  {s.gracePeriodMin} mnt
                </Td>
                <Td tabular align="right">
                  {s.lateThresholdMin} mnt
                </Td>
              </Tr>
            ))}
            {shifts.length === 0 && (
              <EmptyRow colSpan={5}>Belum ada shift. Gunakan tombol “Tambah shift”.</EmptyRow>
            )}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}