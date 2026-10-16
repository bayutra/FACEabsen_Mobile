import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ReviewButtons } from '@/components/review-buttons';
import { Badge } from '@/components/ui/surface';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';

interface ChangeRow {
  id: string;
  status: string;
  reason: string;
  requestedAt: string;
  employee?: { id: string; name: string; employeeNo: string } | null;
  oldDevice?: { id: string; deviceName?: string | null; platform: string } | null;
  newDevice?: { id: string; deviceName?: string | null; platform: string } | null;
}

// STEP 18 — replacement approval queue (admin). Endpoint: STEP 8.
export default async function ReplacementsPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${backendUrl()}/device-change?status=PENDING`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat pengajuan');

  const items = (await res.json()) as ChangeRow[];

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Keamanan
            <span className="text-primary">/ Penggantian Perangkat</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Pengajuan Penggantian</h1>
          <p className="text-body-sm text-outline">
            {items.length} pengajuan menunggu persetujuan Anda.
          </p>
        </div>
      </div>

      {items.map((r) => (
        <section
          key={r.id}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-headline-md text-on-surface">{r.employee?.name}</p>
              <p className="tabular text-label-sm text-outline">{r.employee?.employeeNo}</p>
            </div>
            <Badge tone="warning">Menunggu</Badge>
          </div>

          <p className="mt-2 text-body-md text-on-surface-variant">{r.reason}</p>

          {/* DESIGN.md swap card: old → new in a dual pane. */}
          <div className="mt-space-md flex flex-wrap items-center gap-space-sm">
            <span className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
              {r.oldDevice?.deviceName ?? r.oldDevice?.platform ?? '—'}
            </span>
            <ArrowRight className="text-secondary" size={18} aria-hidden />
            <span className="rounded-lg border border-primary/30 bg-surface-container-low px-3 py-2 text-body-sm font-medium text-primary">
              {r.newDevice?.deviceName ?? r.newDevice?.platform ?? '—'}
            </span>
          </div>

          <div className="mt-space-md border-t border-outline-variant/30 pt-space-md">
            <ReviewButtons kind="device-change" id={r.id} />
          </div>
        </section>
      ))}

      {items.length === 0 && (
        <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-10 text-center text-body-md text-outline">
          Tidak ada pengajuan menunggu.
        </p>
      )}
    </div>
  );
}
