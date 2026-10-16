import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, notFound, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';

interface Props {
  params: Promise<{ id: string }>;
}

interface MemberDetail {
  member: {
    id: string;
    name: string;
    employeeNo: string;
    position?: string | null;
    department?: { id: string; name: string } | null;
  };
  recent: Array<{
    id: string;
    workDate: string;
    checkInAt?: string | null;
    checkOutAt?: string | null;
    checkInStatus?: string | null;
    shift?: { id: string; name: string } | null;
  }>;
}

// STEP 17 — team member detail (supervisor-scoped).
export default async function TeamMemberPage({ params }: Props) {
  const { id } = await params;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${backendUrl()}/supervisor/team/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) notFound();
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat anggota');

  const { member, recent } = (await res.json()) as MemberDetail;
  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/team" className="text-sm text-outline underline-offset-4 hover:underline">
        ← Kembali ke tim
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{member.name}</h1>
      <dl className="overflow-hidden rounded-xl border border-outline-variant bg-surface text-sm">
        {(
          [
            ['NIP', member.employeeNo],
            ['Jabatan', member.position ?? '—'],
            ['Departemen', member.department?.name ?? '—'],
          ] as const
        ).map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-3 gap-2 border-b border-outline-variant px-4 py-2.5 last:border-0"
          >
            <dt className="text-outline">{k}</dt>
            <dd className="col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="font-medium">10 presensi terakhir</h2>
      <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface">
        <table className="w-full text-left text-sm">
          <tbody>
            {recent.map((a) => (
              <tr key={a.id} className="border-b border-outline-variant last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs">
                  {new Date(a.workDate).toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {fmt(a.checkInAt)} / {fmt(a.checkOutAt)}
                </td>
                <td className="px-4 py-2.5 text-xs">{a.checkInStatus}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-outline">Belum ada presensi.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
