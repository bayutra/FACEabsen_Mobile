import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ReviewButtons } from '@/components/review-buttons';
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
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';

interface Props {
  searchParams: Promise<{ status?: string; type?: string }>;
}

interface LeaveRow {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  reason: string;
  requestedAt: string;
  reviewNote?: string | null;
  employee?: { id: string; name: string; employeeNo: string } | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

const TYPE_LABEL: Record<string, string> = {
  IZIN: 'Izin',
  CUTI: 'Cuti',
  DINAS: 'Dinas Luar',
  SICK: 'Sakit',
};

const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** Calendar days inclusive of both ends, so 09→10 is 2 days, not 1. */
function dayCount(start: string, end: string): number {
  const ms = new Date(day(end)).getTime() - new Date(day(start)).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

// STEP 24 — admin leave queue: approve/reject izin, cuti, dinas.
export default async function LeavesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const qs = new URLSearchParams();
  if (sp.status) qs.set('status', sp.status);
  if (sp.type) qs.set('type', sp.type);

  const res = await fetch(`${backendUrl()}/leaves?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat pengajuan izin');

  const items = (await res.json()) as LeaveRow[];
  const pending = items.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Persetujuan
            <span className="text-primary">/ Izin &amp; Cuti</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Pengajuan Izin &amp; Cuti</h1>
          <p className="text-body-sm text-outline">
            {pending > 0
              ? `${pending} pengajuan menunggu keputusan Anda.`
              : 'Tidak ada pengajuan yang menunggu.'}
          </p>
        </div>
      </div>

      <FilterBar>
        <Field label="Status">
          <select name="status" defaultValue={sp.status ?? ''} className={inputClass}>
            <option value="">Semua status</option>
            <option value="PENDING">Menunggu</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </Field>
        <Field label="Jenis">
          <select name="type" defaultValue={sp.type ?? ''} className={inputClass}>
            <option value="">Semua jenis</option>
            <option value="IZIN">Izin</option>
            <option value="CUTI">Cuti</option>
            <option value="DINAS">Dinas Luar</option>
            <option value="SICK">Sakit</option>
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
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Tiket</Th>
              <Th>Karyawan</Th>
              <Th>Jenis</Th>
              <Th>Periode</Th>
              <Th align="right">Hari</Th>
              <Th>Alasan</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <Tr key={l.id}>
                <Td tabular>{l.id.slice(0, 8).toUpperCase()}</Td>
                <Td>
                  <p className="font-medium">{l.employee?.name ?? '—'}</p>
                  <p className="tabular text-label-sm text-outline">{l.employee?.employeeNo}</p>
                </Td>
                <Td>
                  <Badge tone="info">{TYPE_LABEL[l.type] ?? l.type}</Badge>
                </Td>
                <Td tabular>
                  {day(l.startDate)} → {day(l.endDate)}
                </Td>
                <Td tabular align="right">
                  {dayCount(l.startDate, l.endDate)}
                </Td>
                <Td>
                  <p className="text-body-md">{l.reason}</p>
                  {l.reviewNote ? (
                    <p className="mt-0.5 text-label-sm text-outline">Catatan: {l.reviewNote}</p>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[l.status] ?? 'neutral'}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </Badge>
                </Td>
              </Tr>
            ))}
            {items.length === 0 && (
              <EmptyRow colSpan={7}>Tidak ada pengajuan izin pada filter ini.</EmptyRow>
            )}
          </tbody>
        </table>
      </TableShell>

      {pending > 0 ? (
        <section className="space-y-space-md">
          <h2 className="text-headline-md text-on-surface">Butuh Keputusan Anda</h2>
          {items
            .filter((i) => i.status === 'PENDING')
            .map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-headline-md text-on-surface">{l.employee?.name}</p>
                    <p className="tabular text-label-sm text-outline">{l.employee?.employeeNo}</p>
                  </div>
                  <Badge tone="info">{TYPE_LABEL[l.type] ?? l.type}</Badge>
                </div>
                <p className="tabular mt-2 text-body-md text-primary">
                  {day(l.startDate)} → {day(l.endDate)} · {dayCount(l.startDate, l.endDate)} hari
                </p>
                <p className="mt-1 text-body-md text-on-surface-variant">{l.reason}</p>
                <div className="mt-space-md border-t border-outline-variant/30 pt-space-md">
                  <ReviewButtons kind="leaves" id={l.id} />
                </div>
              </div>
            ))}
        </section>
      ) : null}
    </div>
  );
}
