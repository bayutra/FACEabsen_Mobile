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
  searchParams: Promise<{ status?: string }>;
}

interface CorrectionRow {
  id: string;
  type: string;
  status: string;
  reason: string;
  requestedAt: string;
  reviewNote?: string | null;
  employee?: { id: string; name: string; employeeNo: string } | null;
  attendance?: {
    id: string;
    workDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  } | null;
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
  CHECK_IN: 'Jam Masuk',
  CHECK_OUT: 'Jam Pulang',
  BOTH: 'Masuk & Pulang',
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

// STEP 24 — admin correction queue: review + approve/reject with a note.
export default async function CorrectionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const qs = new URLSearchParams();
  if (sp.status) qs.set('status', sp.status);

  const res = await fetch(`${backendUrl()}/corrections?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat pengajuan koreksi');

  const items = (await res.json()) as CorrectionRow[];
  const pending = items.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Persetujuan
            <span className="text-primary">/ Koreksi Presensi</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Koreksi Presensi</h1>
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
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488]"
        >
          Tampilkan
        </button>
      </FilterBar>

      <TableShell>
        <table className="w-full min-w-[880px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Tiket</Th>
              <Th>Karyawan</Th>
              <Th>Presensi</Th>
              <Th>Jenis</Th>
              <Th>Alasan</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <Tr key={c.id}>
                <Td tabular>{c.id.slice(0, 8).toUpperCase()}</Td>
                <Td>
                  <p className="font-medium">{c.employee?.name ?? '—'}</p>
                  <p className="tabular text-label-sm text-outline">{c.employee?.employeeNo}</p>
                </Td>
                <Td tabular>
                  {c.attendance ? (
                    <>
                      {new Date(c.attendance.workDate).toISOString().slice(0, 10)}
                      <p className="text-outline">
                        {fmt(c.attendance.checkInAt)} / {fmt(c.attendance.checkOutAt)}
                      </p>
                    </>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  <Badge tone="info">{TYPE_LABEL[c.type] ?? c.type}</Badge>
                </Td>
                <Td>
                  <p className="text-body-md">{c.reason}</p>
                  {c.reviewNote ? (
                    <p className="mt-0.5 text-label-sm text-outline">Catatan: {c.reviewNote}</p>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </Td>
              </Tr>
            ))}
            {items.length === 0 && (
              <EmptyRow colSpan={6}>Tidak ada pengajuan koreksi pada filter ini.</EmptyRow>
            )}
          </tbody>
        </table>
      </TableShell>

      {/* Reviewed rows cannot be actioned again, so the buttons live outside the
          table where there is room and the pending state is unambiguous. */}
      {pending > 0 ? (
        <section className="space-y-space-md">
          <h2 className="text-headline-md text-on-surface">Butuh Keputusan Anda</h2>
          {items
            .filter((i) => i.status === 'PENDING')
            .map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-headline-md text-on-surface">{c.employee?.name}</p>
                    <p className="tabular text-label-sm text-outline">{c.employee?.employeeNo}</p>
                  </div>
                  <Badge tone="warning">{TYPE_LABEL[c.type] ?? c.type}</Badge>
                </div>
                <p className="mt-2 text-body-md text-on-surface-variant">{c.reason}</p>
                {c.attendance ? (
                  <p className="tabular mt-1 text-body-sm text-outline">
                    {new Date(c.attendance.workDate).toISOString().slice(0, 10)} · masuk{' '}
                    {fmt(c.attendance.checkInAt)} · pulang {fmt(c.attendance.checkOutAt)}
                  </p>
                ) : null}
                <div className="mt-space-md border-t border-outline-variant/30 pt-space-md">
                  <ReviewButtons kind="corrections" id={c.id} />
                </div>
              </div>
            ))}
        </section>
      ) : null}
    </div>
  );
}
