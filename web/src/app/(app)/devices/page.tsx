import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { deviceStatusLabel, type DeviceListResponse } from '@/lib/devices';
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
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}

// STEP 18 — admin device list (PRD §63): status filter + search + pagination.
export default async function DevicesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const qs = new URLSearchParams();
  if (sp.page) qs.set('page', sp.page);
  if (sp.status) qs.set('status', sp.status);
  if (sp.search) qs.set('search', sp.search);

  const res = await fetch(`${backendUrl()}/devices?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat perangkat');

  const { data, pagination } = (await res.json()) as DeviceListResponse;
  const pageHref = (p: number) => {
    const next = new URLSearchParams(qs.toString());
    next.set('page', String(p));
    return `/devices?${next.toString()}`;
  };

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Keamanan
            <span className="text-primary">/ Perangkat Terdaftar</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Otorisasi Perangkat</h1>
          <p className="text-body-sm text-outline">
            Hanya perangkat berstatus Aktif yang boleh melakukan presensi.
          </p>
        </div>
        <Link
          href="/devices/replacements"
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-body-md-medium text-primary transition-colors hover:bg-surface-container-low"
        >
          Pengajuan Penggantian →
        </Link>
      </div>

      <FilterBar>
        <Field label="Cari" className="w-64">
          <input
            type="search"
            name="search"
            placeholder="Nama perangkat atau installation ID"
            defaultValue={sp.search ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={sp.status ?? ''} className={inputClass}>
            <option value="">Semua status</option>
            <option value="PENDING">Menunggu</option>
            <option value="ACTIVE">Aktif</option>
            <option value="REVOKED">Dicabut</option>
            <option value="LOST">Hilang</option>
            <option value="REPLACED">Diganti</option>
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
              <Th>Perangkat</Th>
              <Th>Karyawan</Th>
              <Th>Status</Th>
              <Th>Terakhir terlihat</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <Link
                    href={`/devices/${d.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {d.deviceName || d.platform}
                  </Link>
                  {/* Installation IDs are long hex — tabular keeps them aligned. */}
                  <p className="tabular text-label-sm text-outline">{d.installationId}</p>
                </Td>
                <Td>
                  <p className="font-medium">{d.employee?.name ?? '—'}</p>
                  <p className="tabular text-label-sm text-outline">{d.employee?.employeeNo ?? ''}</p>
                </Td>
                <Td>
                  <Badge
                    tone={
                      d.status === 'ACTIVE'
                        ? 'success'
                        : d.status === 'PENDING'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {deviceStatusLabel(d.status)}
                  </Badge>
                </Td>
                <Td tabular>
                  {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('id-ID') : '—'}
                </Td>
              </Tr>
            ))}
            {data.length === 0 && (
              <EmptyRow colSpan={4}>Tidak ada perangkat pada filter ini.</EmptyRow>
            )}
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
