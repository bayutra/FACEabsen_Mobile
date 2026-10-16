import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { riskBadgeClass, type AttendanceListResponse } from '@/lib/attendance';
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
  searchParams: Promise<{
    page?: string;
    search?: string;
    departmentId?: string;
    from?: string;
    to?: string;
    checkInStatus?: string;
    riskCategory?: string;
    needsReview?: string;
  }>;
}

interface Department {
  id: string;
  name: string;
}

// STEP 14 — admin attendance queue (PRD §59 web): search + department,
// employee date, status, risk filters. Server-rendered, no JS needed.
export default async function AttendancePage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const auth = { Authorization: `Bearer ${token}` };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);

  const [res, deptRes] = await Promise.all([
    fetch(`${backendUrl()}/attendance?${qs.toString()}`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/departments`, { headers: auth, cache: 'no-store' }),
  ]);
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat riwayat absensi');

  const { data, pagination } = (await res.json()) as AttendanceListResponse;
  const departments: Department[] = deptRes.ok ? await deptRes.json() : [];

  const pageHref = (p: number) => {
    const next = new URLSearchParams(qs.toString());
    next.set('page', String(p));
    return `/attendance?${next.toString()}`;
  };

  const fmtTime = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '—';

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Kehadiran
            <span className="text-primary">/ Rekap Absensi</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Rekap Absensi Harian</h1>
          <p className="text-body-sm text-outline">
            Verifikasi lokasi, liveness, dan skor risiko setiap catatan punch.
          </p>
        </div>
      </div>

      <FilterBar>
        <Field label="Cari" className="w-52">
          <input
            type="search"
            name="search"
            placeholder="Nama atau NIP"
            defaultValue={sp.search ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Departemen">
          <select name="departmentId" defaultValue={sp.departmentId ?? ''} className={inputClass}>
            <option value="">Semua departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dari">
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={inputClass} />
        </Field>
        <Field label="Sampai">
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={inputClass} />
        </Field>
        <Field label="Status Masuk">
          <select name="checkInStatus" defaultValue={sp.checkInStatus ?? ''} className={inputClass}>
            <option value="">Semua status</option>
            <option value="ON_TIME">Tepat waktu</option>
            <option value="LATE">Terlambat</option>
            <option value="VERY_LATE">Sangat terlambat</option>
          </select>
        </Field>
        <Field label="Kategori Risiko">
          <select name="riskCategory" defaultValue={sp.riskCategory ?? ''} className={inputClass}>
            <option value="">Semua risiko</option>
            <option value="LOW">Rendah</option>
            <option value="MEDIUM">Sedang</option>
            <option value="HIGH">Tinggi</option>
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
        <table className="w-full min-w-[1100px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Tanggal</Th>
              <Th>Karyawan</Th>
              <Th>Shift</Th>
              <Th>Masuk / Pulang</Th>
              <Th>Titik Tap</Th>
              <Th>Status</Th>
              <Th>Risiko</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <Tr key={a.id}>
                <Td tabular>{new Date(a.workDate).toISOString().slice(0, 10)}</Td>
                <Td>
                  <p className="font-medium">{a.employee?.name ?? '—'}</p>
                  <p className="tabular text-label-sm text-outline">
                    {a.employee?.employeeNo ?? ''} · {a.employee?.department?.name ?? ''}
                  </p>
                </Td>
                <Td>
                  <p>{a.shift?.name ?? '—'}</p>
                  <p className="tabular text-label-sm text-outline">
                    {a.shift ? `${a.shift.startTime} → ${a.shift.endTime}` : ''}
                  </p>
                </Td>
                <Td tabular>
                  {fmtTime(a.checkInAt)} / {fmtTime(a.checkOutAt)}
                </Td>
                <Td tabular>
                  {a.checkInLat !== null &&
                  a.checkInLat !== undefined &&
                  a.checkInLon !== null &&
                  a.checkInLon !== undefined ? (
                    <>
                      <p>
                        {a.checkInLat.toFixed(5)}, {a.checkInLon.toFixed(5)}
                      </p>
                      <p className="text-label-sm text-outline">
                        {a.checkInAccuracy !== null && a.checkInAccuracy !== undefined
                          ? `±${Math.round(a.checkInAccuracy)} m · `
                          : ''}
                        {a.geofencePass === true
                          ? 'dalam radius'
                          : a.geofencePass === false
                            ? 'luar radius'
                            : ''}
                      </p>
                    </>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  {a.checkInStatus === 'ON_TIME' ? (
                    <Badge tone="success">Tepat waktu</Badge>
                  ) : (
                    <Badge tone="warning">{a.checkInStatus}</Badge>
                  )}
                </Td>
                <Td>
                  <span className={`inline-flex rounded-md px-2.5 py-2 text-label-md ${riskBadgeClass(a.riskCategory)}`}>
                    {a.riskCategory ?? '—'}
                    {a.riskScore !== null && a.riskScore !== undefined ? ` ${a.riskScore}` : ''}
                  </span>
                  {a.needsReview && <p className="mt-1 text-warning-fg">perlu review</p>}
                </Td>
                <Td>
                  <Link
                    href={`/attendance/${a.id}`}
                    className="text-body-md-medium text-primary hover:underline"
                  >
                    Detail
                  </Link>
                </Td>
              </Tr>
            ))}
            {data.length === 0 && <EmptyRow colSpan={8}>Tidak ada data pada filter ini.</EmptyRow>}
          </tbody>
        </table>
      </TableShell>

      <div className="flex items-center justify-between text-body-sm text-outline">
        <p className="tabular">
          Halaman {pagination.page} dari {Math.max(pagination.totalPages, 1)} ·{' '}
          {pagination.totalItems} data
        </p>
        <div className="flex gap-2">
          {pagination.page > 1 && (
            <Link
              href={pageHref(pagination.page - 1)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              ← Sebelumnya
            </Link>
          )}
          {pagination.page < pagination.totalPages && (
            <Link
              href={pageHref(pagination.page + 1)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              Berikutnya →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
