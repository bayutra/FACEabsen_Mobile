import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl, hospitalToday } from '@/lib/api';
import type { TeamSummary } from '@/lib/team';
import {
  Badge,
  Field,
  FilterBar,
  TableShell,
  Td,
  Th,
  Tr,
  inputClass,
} from '@/components/ui/surface';

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function monthRange(): { from: string; to: string } {
  const today = hospitalToday();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

// STEP 17 — team report (per-member day matrix + totals). Export formats: STEP 20.
export default async function TeamReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const def = monthRange();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;

  const res = await fetch(`${backendUrl()}/supervisor/summary?from=${from}&to=${to}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat laporan tim');

  const summary = (await res.json()) as TeamSummary;
  const dayOf = (d: string) => d.slice(8, 10);
  const dates = summary.members[0] ? Object.keys(summary.members[0].days) : [];
  const short: Record<string, string> = {
    PRESENT: 'H',
    LATE: 'T',
    ABSENT: 'A',
    ON_LEAVE: 'I',
    OFF: '·',
  };

  return (
    <div className="space-y-gutter">
      <FilterBar>
        <Field label="Dari">
          <input type="date" name="from" defaultValue={from} className={inputClass} />
        </Field>
        <Field label="Sampai">
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </Field>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488]"
        >
          Tampilkan
        </button>
      </FilterBar>

      <div className="grid grid-cols-2 gap-space-md lg:grid-cols-5">
        {(
          [
            ['Anggota', summary.totals.members, 'neutral'],
            ['Hadir', summary.totals.present, 'success'],
            ['Terlambat', summary.totals.late, 'warning'],
            ['Tidak hadir', summary.totals.absent, 'danger'],
            ['Izin / cuti', summary.totals.onLeave, 'info'],
          ] as const
        ).map(([label, value, tone]) => (
          <section
            key={label}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-surface-1"
          >
            <p className="text-label-md text-outline">{label}</p>
            <p className="tabular mt-1 text-headline-lg text-on-surface">{value}</p>
            <Badge tone={tone} className="mt-1">hari ini</Badge>
          </section>
        ))}
      </div>

      {/* Roster matrix: one row per member, one column per day. Tabular figures
          keep the single-letter markers in a strict grid. */}
      <TableShell>
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Anggota</Th>
              {dates.map((d) => (
                <Th key={d} align="center">
                  {dayOf(d)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.members.map((m) => (
              <Tr key={m.id}>
                <Td>
                  <p className="font-medium">{m.name}</p>
                  <p className="tabular text-label-sm text-outline">{m.employeeNo}</p>
                </Td>
                {dates.map((d) => (
                  <Td key={d} tabular align="center">
                    {short[m.days[d]] ?? '?'}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      <p className="text-label-sm text-outline">
        H hadir · T terlambat · A tidak hadir · I izin/cuti · · libur
      </p>
    </div>
  );
}
