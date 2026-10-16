import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import type { EmployeeListResponse } from '@/lib/employees';
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
import { EmployeeCreateForm } from './employee-create-form';

interface Props {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}

interface DepartmentRow {
  id: string;
  name: string;
}

// STEP 5 — employees list (read) + provisioning (create, admin only).
export default async function EmployeesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const authHeader = { Authorization: `Bearer ${token}` };

  const qs = new URLSearchParams();
  if (sp.page) qs.set('page', sp.page);
  if (sp.status) qs.set('status', sp.status);
  if (sp.search) qs.set('search', sp.search);

  // Keempat request backend dilepas sekaligus dalam satu Promise.all —
  // daftar, sesi, departemen, dan kandidat atasan tidak saling bergantung.
  const [res, meRes, deptRes, supRes] = await Promise.all([
    fetch(`${backendUrl()}/employees?${qs.toString()}`, {
      headers: authHeader,
      cache: 'no-store',
    }),
    fetch(`${backendUrl()}/auth/me`, { headers: authHeader, cache: 'no-store' }),
    fetch(`${backendUrl()}/departments`, { headers: authHeader, cache: 'no-store' }),
    // Supervisor options come from a dedicated large fetch: the paged table
    // above defaults to 20 rows, which would silently hide most candidates.
    // Backend caps pageSize at 100 (ListEmployeesQuery @Max(100)).
    fetch(`${backendUrl()}/employees?status=ACTIVE&pageSize=100`, {
      headers: authHeader,
      cache: 'no-store',
    }),
  ]);
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat data karyawan');

  const { data, pagination } = (await res.json()) as EmployeeListResponse;
  const page = pagination.page;
  const totalPages = pagination.totalPages;

  // Lookup data for the create form; failures degrade to "no options"
  // rather than breaking the whole page.
  const me = meRes.ok ? ((await meRes.json()) as { permissions?: string[] }) : null;
  const canCreate = !!me?.permissions?.includes('employee:create');

  let departments: { id: string; label: string }[] = [];
  let supervisors: { id: string; label: string }[] = [];
  let supervisorsTruncated = false;
  if (canCreate) {
    if (deptRes.ok) {
      const raw = (await deptRes.json()) as DepartmentRow[];
      departments = raw.map((d) => ({ id: d.id, label: d.name }));
    }
    if (supRes.ok) {
      const sup = (await supRes.json()) as EmployeeListResponse;
      supervisors = sup.data.map((e) => ({ id: e.id, label: `${e.name} (${e.employeeNo})` }));
      supervisorsTruncated = sup.pagination.totalItems > sup.data.length;
    } else {
      supervisors = data.map((e) => ({ id: e.id, label: `${e.name} (${e.employeeNo})` }));
    }
  }

  const pageHref = (p: number) => {
    const next = new URLSearchParams(qs.toString());
    next.set('page', String(p));
    return `/employees?${next.toString()}`;
  };

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Master Data
            <span className="text-primary">/ Karyawan &amp; Staf</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Manajemen Karyawan</h1>
          <p className="text-body-sm text-outline">
            Sumber data unik untuk presensi, jadwal, dan keanggotaan tim.
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-col items-end gap-1">
            <EmployeeCreateForm departments={departments} supervisors={supervisors} />
            {supervisorsTruncated && (
              <p className="text-body-sm text-outline">
                Pilihan atasan menampilkan 100 pertama — gunakan pencarian.
              </p>
            )}
          </div>
        )}
      </div>

      <FilterBar>
        <Field label="Cari" className="w-64">
          <input
            type="search"
            name="search"
            placeholder="Nama, email, atau NIP"
            defaultValue={sp.search ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={sp.status ?? ''} className={inputClass}>
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </Field>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488]"
        >
          Cari
        </button>
      </FilterBar>

      <TableShell>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>NIP</Th>
              <Th>Nama</Th>
              <Th>Departemen</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <Tr key={e.id}>
                <Td tabular>{e.employeeNo}</Td>
                <Td>
                  <Link
                    href={`/employees/${e.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {e.name}
                  </Link>
                  <p className="text-label-sm text-outline">{e.email}</p>
                </Td>
                <Td>{e.department?.name ?? '—'}</Td>
                <Td>
                  <Badge tone={e.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {e.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </Td>
              </Tr>
            ))}
            {data.length === 0 && <EmptyRow colSpan={4}>Tidak ada data karyawan.</EmptyRow>}
          </tbody>
        </table>
      </TableShell>

      <div className="flex items-center justify-between text-body-sm text-outline">
        <p className="tabular">
          Halaman {page} dari {Math.max(totalPages, 1)} · {pagination.totalItems} data
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              ← Sebelumnya
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={pageHref(page + 1)}
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
