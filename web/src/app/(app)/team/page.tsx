import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl, hospitalToday } from '@/lib/api';
import type { TeamMember, TeamSummary } from '@/lib/team';
import { EmptyRow, TableShell, Td, Th, Tr } from '@/components/ui/surface';

function todayKey(): string {
  return hospitalToday();
}

// STEP 17 — team monitoring (PRD §62): today's totals + member roster.
export default async function TeamPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const auth = { Authorization: `Bearer ${token}` };
  const today = todayKey();
  const [teamRes, sumRes, corrRes, leaveRes] = await Promise.all([
    fetch(`${backendUrl()}/supervisor/team`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/supervisor/summary?from=${today}&to=${today}`, {
      headers: auth,
      cache: 'no-store',
    }),
    fetch(`${backendUrl()}/corrections?status=PENDING`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/leaves?status=PENDING`, { headers: auth, cache: 'no-store' }),
  ]);
  if (teamRes.status === 401) redirect('/login');
  if (teamRes.status === 403) forbidden();
  if (!teamRes.ok || !sumRes.ok) throw new Error('Gagal memuat tim');

  const members = (await teamRes.json()) as TeamMember[];
  const summary = (await sumRes.json()) as TeamSummary;
  // Antrean pending (best-effort): kegagalan fetch tidak menggagalkan halaman.
  const pendingCount = async (res: Response): Promise<number | null> => {
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as
      | unknown[]
      | { data?: unknown[] }
      | null;
    if (Array.isArray(body)) return body.length;
    if (body && Array.isArray(body.data)) return body.data.length;
    return null;
  };
  const [pendingCorrections, pendingLeaves] = await Promise.all([
    pendingCount(corrRes),
    pendingCount(leaveRes),
  ]);
  const cards = [
    { label: 'Anggota', value: summary.totals.members, tone: 'neutral' },
    { label: 'Hadir', value: summary.totals.present, tone: 'success' },
    { label: 'Terlambat', value: summary.totals.late, tone: 'warning' },
    { label: 'Tidak hadir', value: summary.totals.absent, tone: 'danger' },
    { label: 'Izin / cuti', value: summary.totals.onLeave, tone: 'info' },
  ] as const;

  const TONE: Record<string, string> = {
    success: 'text-success-fg bg-success-bg border-success-border',
    warning: 'text-warning-fg bg-warning-bg border-warning-border',
    danger: 'text-danger-fg bg-danger-bg border-danger-border',
    info: 'text-info-fg bg-info-bg border-info-border',
    neutral: 'text-on-surface-variant bg-surface-container-low border-outline-variant/40',
  };

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Supervisi
            <span className="text-primary">/ Dashboard Tim</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Tim Saya</h1>
          <p className="text-body-sm text-outline">
            Kehadiran hari ini beserta roster anggota yang Anda awasi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-space-md lg:grid-cols-5">
        {cards.map((c) => (
          <section
            key={c.label}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-surface-1"
          >
            <p className="text-label-md text-outline">{c.label}</p>
            <p className="tabular mt-1 text-headline-lg text-on-surface">{c.value}</p>
            <span
              className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${TONE[c.tone]}`}
            >
              hari ini
            </span>
          </section>
        ))}
      </div>

      <div className="grid gap-space-md md:grid-cols-2">
        <Link
          href="/team/corrections"
          className="flex items-center justify-between rounded-xl border border-warning-border bg-warning-bg px-4 py-3 transition-colors hover:brightness-95"
        >
          <span className="text-body-md-medium text-warning-fg">Koreksi menunggu persetujuan</span>
          <span className="tabular text-headline-md text-warning-fg">
            {pendingCorrections ?? '—'}
          </span>
        </Link>
        <Link
          href="/team/leaves"
          className="flex items-center justify-between rounded-xl border border-info-border bg-info-bg px-4 py-3 transition-colors hover:brightness-95"
        >
          <span className="text-body-md-medium text-info-fg">Izin / cuti menunggu persetujuan</span>
          <span className="tabular text-headline-md text-info-fg">{pendingLeaves ?? '—'}</span>
        </Link>
      </div>

      <TableShell>
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Nama</Th>
              <Th>NIP</Th>
              <Th>Departemen</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <Tr key={m.id}>
                <Td>
                  <Link
                    href={`/team/members/${m.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {m.name}
                  </Link>
                  {m.position && <p className="text-label-sm text-outline">{m.position}</p>}
                </Td>
                <Td tabular>{m.employeeNo}</Td>
                <Td>{m.department?.name ?? '—'}</Td>
              </Tr>
            ))}
            {members.length === 0 && <EmptyRow colSpan={3}>Belum ada anggota tim.</EmptyRow>}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
