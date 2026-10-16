import { cookies } from 'next/headers';
import { Building2 } from 'lucide-react';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { loadHospitals, type DepartmentRow } from '@/lib/master-data';
import { EmptyRow, TableShell, Td, Th, Tr } from '@/components/ui/surface';
import { DepartmentCreateForm } from './department-create-form';
import { DepartmentRowActions } from './department-row-actions';

/**
 * Departments are the facility directory. Reads need `employee:read`; writes
 * need `department:manage` (granted to ADMIN and, by rank inheritance,
 * SUPER_ADMIN). A delete is refused while staff are still assigned, and that
 * reason comes back from the API to the row action.
 */
export default async function DepartmentsPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const auth = { Authorization: `Bearer ${token}` };
  const [deptRes, hospitals] = await Promise.all([
    fetch(`${backendUrl()}/departments`, { headers: auth, cache: 'no-store' }),
    loadHospitals(backendUrl(), token),
  ]);

  if (deptRes.status === 401) redirect('/login');
  if (deptRes.status === 403) forbidden();
  if (!deptRes.ok) throw new Error('Gagal memuat departemen');

  const departments = (await deptRes.json()) as DepartmentRow[];
  const facilities = [...new Map(departments.map((d) => [d.hospital?.id, d.hospital])).values()];

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Master Data
            <span className="text-primary">/ Departemen</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Direktori Departemen</h1>
          <p className="text-body-sm text-outline">
            {departments.length} departemen pada {facilities.length} fasilitas.
          </p>
        </div>
        <DepartmentCreateForm hospitals={hospitals} />
      </div>

      <TableShell>
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Departemen</Th>
              <Th>Fasilitas</Th>
              <Th>Dibuat</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <span className="flex items-center gap-2 font-medium">
                    <Building2 size={15} className="text-primary" aria-hidden />
                    {d.name}
                  </span>
                </Td>
                <Td>
                  {d.hospital ? (
                    <>
                      {d.hospital.name}
                      <p className="tabular text-label-sm text-outline">{d.hospital.code}</p>
                    </>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td tabular>{new Date(d.createdAt).toLocaleDateString('id-ID')}</Td>
                <Td align="right">
                  <DepartmentRowActions id={d.id} name={d.name} />
                </Td>
              </Tr>
            ))}
            {departments.length === 0 && (
              <EmptyRow colSpan={4}>Belum ada departemen.</EmptyRow>
            )}
          </tbody>
        </table>
      </TableShell>

      <p className="text-body-sm text-outline">
        Penetapan karyawan ke departemen dilakukan dari halaman Tambah Karyawan. Departemen yang
        masih memiliki karyawan tidak dapat dihapus.
      </p>
    </div>
  );
}