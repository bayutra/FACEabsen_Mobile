import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import type { AuditListResponse } from '@/lib/audit';
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
    action?: string;
    actorEmail?: string;
    result?: string;
    from?: string;
    to?: string;
    security?: string;
  }>;
}

// STEP 19 — audit viewer (PRD §64): filter + search, read-only (no edit UI).
export default async function AuditPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const auth = { Authorization: `Bearer ${token}` };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v);

  const [res, actionsRes] = await Promise.all([
    fetch(`${backendUrl()}/audit?${qs.toString()}`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/audit/actions`, { headers: auth, cache: 'no-store' }),
  ]);
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat audit log');

  const { data, pagination } = (await res.json()) as AuditListResponse;
  const actions: string[] = actionsRes.ok ? await actionsRes.json() : [];

  const pageHref = (p: number) => {
    const next = new URLSearchParams(qs.toString());
    next.set('page', String(p));
    return `/audit?${next.toString()}`;
  };

  const resultTone = (r?: string | null): 'success' | 'warning' | 'danger' =>
    r === 'SUCCESS' ? 'success' : r === 'FAILED' ? 'warning' : 'danger';

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Keamanan
            <span className="text-primary">/ Audit Log</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Jejak Audit Sistem</h1>
          <p className="text-body-sm text-outline">
            Setiap aksi administratif tercatat dan tidak dapat disunting.
          </p>
        </div>
        <a
          href={`/api/audit/export?${qs.toString()}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-md-medium text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Unduh CSV (maks 5000 baris)
        </a>
      </div>

      <FilterBar>
        <Field label="Aksi">
          <select name="action" defaultValue={sp.action ?? ''} className={inputClass}>
            <option value="">Semua aksi</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pelaku" className="w-52">
          <input
            type="search"
            name="actorEmail"
            placeholder="Cari email pelaku"
            defaultValue={sp.actorEmail ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Hasil">
          <select name="result" defaultValue={sp.result ?? ''} className={inputClass}>
            <option value="">Semua hasil</option>
            <option value="SUCCESS">Sukses</option>
            <option value="FAILED">Gagal</option>
            <option value="DENIED">Ditolak</option>
          </select>
        </Field>
        <Field label="Dari">
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={inputClass} />
        </Field>
        <Field label="Sampai">
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={inputClass} />
        </Field>
        <label className="flex h-10 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface">
          <input type="checkbox" name="security" value="true" defaultChecked={sp.security === 'true'} />
          Keamanan saja
        </label>
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
              <Th>Waktu</Th>
              <Th>Pelaku</Th>
              <Th>Aksi</Th>
              <Th>Target</Th>
              <Th>IP / Jaringan</Th>
              <Th>Klien / Perangkat</Th>
              <Th>Hasil</Th>
            </tr>
          </thead>          <tbody>
            {data.map((l) => (
              <Tr key={l.id}>
                <Td tabular>{new Date(l.timestamp).toLocaleString('id-ID')}</Td>
                <Td>
                  <span className="text-body-sm">{l.actor?.email ?? l.actorId ?? '—'}</span>
                </Td>
                <Td tabular>
                  <span className="rounded bg-surface-container-low px-1.5 py-0.5">
                    {l.action}
                  </span>
                </Td>
                <Td tabular>
                  {l.targetType ? `${l.targetType}:${l.targetId ?? ''}` : '—'}
                </Td>
                <Td tabular>{l.ipAddress ?? '—'}</Td>
                <Td>{l.device?.deviceName ?? l.deviceId ?? '—'}</Td>
                <Td>
                  <Badge tone={resultTone(l.result)}>{l.result ?? '—'}</Badge>
                </Td>
              </Tr>
            ))}
            {data.length === 0 && <EmptyRow colSpan={7}>Tidak ada log pada filter ini.</EmptyRow>}
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