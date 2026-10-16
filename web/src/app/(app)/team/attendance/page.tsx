import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import type { TeamAttendanceRow } from '@/lib/team';
import {
  Badge,
  EmptyRow,
  Field,
  FilterBar,
  TableShell,
  Td,
  Th,
  Tr,
  inputClass,
} from '@/components/ui/surface';

interface Props {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}

// STEP 17 — team attendance table with date/status filters.
export default async function TeamAttendancePage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const qs = new URLSearchParams();
  if (sp.from) qs.set('from', sp.from);
  if (sp.to) qs.set('to', sp.to);
  if (sp.status) qs.set('status', sp.status);

  const res = await fetch(`${backendUrl()}/supervisor/attendance?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat absensi tim');

  const rows = (await res.json()) as TeamAttendanceRow[];
  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-gutter">
      <FilterBar>
        <Field label="Dari">
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={inputClass} />
        </Field>
        <Field label="Sampai">
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={inputClass} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={sp.status ?? ''} className={inputClass}>
            <option value="">Semua status</option>
            <option value="ON_TIME">Tepat waktu</option>
            <option value="LATE">Terlambat</option>
            <option value="VERY_LATE">Sangat terlambat</option>
          </select>
        </Field>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488]"
        >
          Tampilkan
        </button>
      </FilterBar>

      <TableShell>
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Tanggal</Th>
              <Th>Anggota</Th>
              <Th>Masuk / Pulang</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <Tr key={a.id}>
                <Td tabular>
                  {new Date(a.workDate).toISOString().slice(0, 10)}
                  <p className="text-outline">{a.shift?.name ?? ''}</p>
                </Td>
                <Td>
                  <p className="font-medium">{a.employee?.name ?? '—'}</p>
                  <p className="tabular text-label-sm text-outline">{a.employee?.employeeNo ?? ''}</p>
                </Td>
                <Td tabular>
                  {fmt(a.checkInAt)} / {fmt(a.checkOutAt)}
                </Td>
                <Td>
                  <Badge
                    tone={
                      a.checkInStatus === 'ON_TIME'
                        ? 'success'
                        : a.checkInStatus === 'LATE'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {a.checkInStatus ?? '—'}
                  </Badge>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={4}>Tidak ada data pada filter ini.</EmptyRow>}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
