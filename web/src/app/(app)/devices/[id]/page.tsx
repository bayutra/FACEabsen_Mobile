import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, notFound, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { deviceStatusLabel, type DeviceDetail } from '@/lib/devices';
import { DeviceActions } from '../device-actions';

interface Props {
  params: Promise<{ id: string }>;
}

// STEP 18 — admin device detail: identity, status, sessions, change history.
export default async function DeviceDetailPage({ params }: Props) {
  const { id } = await params;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${backendUrl()}/devices/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) notFound();
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat perangkat');

  const d = (await res.json()) as DeviceDetail;
  const rows: Array<[string, string]> = [
    ['Status', deviceStatusLabel(d.status)],
    ['Karyawan', d.employee ? `${d.employee.name} (${d.employee.employeeNo})` : '—'],
    ['Platform', d.platform],
    ['Nama', d.deviceName ?? '—'],
    ['App', d.appVersion ?? '—'],
    ['Installation ID', d.installationId],
    ['Terdaftar', new Date(d.registeredAt).toLocaleString('id-ID')],
    ['Terakhir terlihat', d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('id-ID') : '—'],
    ['Alasan cabut', d.revokeReason ?? '—'],
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/devices" className="text-sm text-outline underline-offset-4 hover:underline">
        ← Kembali ke daftar
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{d.deviceName || d.platform}</h1>

      <dl className="overflow-hidden rounded-xl border border-outline-variant bg-surface text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-2 border-b border-outline-variant px-4 py-2.5 last:border-0">
            <dt className="text-outline">{k}</dt>
            <dd className="col-span-2 break-all font-mono text-xs">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-outline-variant bg-surface p-4">
        <h2 className="mb-2 font-medium">Tindakan admin</h2>
        <DeviceActions id={d.id} status={d.status} />
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface p-4">
        <h2 className="mb-2 font-medium">Session ({d.sessions?.length ?? 0})</h2>
        {(d.sessions ?? []).map((s) => (
          <p key={s.id} className="font-mono text-xs text-on-surface">
            {s.id} · {s.revokedAt ? 'dicabut' : 'aktif'}
          </p>
        ))}
        {(d.sessions ?? []).length === 0 && <p className="text-sm text-outline">Tidak ada session.</p>}
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface p-4">
        <h2 className="mb-2 font-medium">Riwayat penggantian</h2>
        {[...(d.oldChanges ?? []), ...(d.newChanges ?? [])].map((c) => (
          <p key={c.id} className="font-mono text-xs text-on-surface">
            {c.id} · {c.status} · {c.reason}
          </p>
        ))}
        {(d.oldChanges ?? []).length + (d.newChanges ?? []).length === 0 && (
          <p className="text-sm text-outline">Belum pernah diganti.</p>
        )}
      </section>
    </div>
  );
}
