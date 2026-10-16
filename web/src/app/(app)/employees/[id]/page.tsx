import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, notFound, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import type { EmployeeDetail } from '@/lib/employees';

interface Props {
  params: Promise<{ id: string }>;
}

// STEP 5 — employee detail (read).
export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${backendUrl()}/employees/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) notFound();
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat detail karyawan');

  const e = (await res.json()) as EmployeeDetail;

  const rows: Array<[string, string]> = [
    ['NIP', e.employeeNo],
    ['Nama', e.name],
    ['Email', e.email],
    ['No. HP', e.phone ?? '—'],
    ['Jabatan', e.position ?? '—'],
    ['Departemen', e.department?.name ?? '—'],
    ['Atasan', e.supervisor ? `${e.supervisor.name} (${e.supervisor.employeeNo})` : '—'],
    ['Status', e.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'],
    ['Login', e.user ? (e.user.isActive ? 'Aktif' : 'Nonaktif') : 'Tanpa akun'],
    ['Role', e.roles?.join(', ') || '—'],
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/employees" className="text-sm text-outline underline-offset-4 hover:underline">
        ← Kembali ke daftar
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{e.name}</h1>
      <dl className="overflow-hidden rounded-xl border border-outline-variant bg-surface text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-2 border-b border-outline-variant px-4 py-2.5 last:border-0">
            <dt className="text-outline">{k}</dt>
            <dd className="col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
