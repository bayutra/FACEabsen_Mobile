import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl, hospitalMonth, hospitalToday } from '@/lib/api';
import { REPORT_TABS, toReportPath, type ReportKind, type ReportPayload } from '@/lib/reports';
import { EmptyRow, TableShell, Td, Th, Tr, inputClass } from '@/components/ui/surface';

interface Props {
  searchParams: Promise<{
    kind?: string;
    date?: string;
    month?: string;
    from?: string;
    to?: string;
    employeeId?: string;
  }>;
}

interface EmployeeOption {
  id: string;
  name: string;
  employeeNo: string;
}

const KINDS = new Set<string>(['daily', 'monthly', 'department', 'employee', 'late', 'leaves']);

// STEP 20 — reports (PRD §65): JSON preview + CSV/XLSX/PDF downloads.
export default async function ReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const kind: ReportKind = KINDS.has(sp.kind ?? '') ? (sp.kind as ReportKind) : 'daily';
  const auth = { Authorization: `Bearer ${token}` };

  const today = hospitalToday();
  const month = hospitalMonth();
  const path = toReportPath({
    kind,
    date: sp.date ?? (kind === 'daily' ? today : undefined),
    month: sp.month ?? (kind === 'monthly' ? month : undefined),
    from: sp.from ?? (kind === 'employee' || kind === 'department' || kind === 'late' || kind === 'leaves' ? `${month}-01` : undefined),
    to: sp.to ?? (kind === 'employee' || kind === 'department' || kind === 'late' || kind === 'leaves' ? today : undefined),
    employeeId: sp.employeeId,
  });

  // Lookup karyawan hanya dipakai kind=employee (dropdown filter) — jangan
  // diambil untuk jenis laporan lain.
  const reportReq = fetch(`${backendUrl()}${path.replace('/api/reports', '/reports')}`, {
    headers: auth,
    cache: 'no-store',
  });
  const employeesReq =
    kind === 'employee'
      ? fetch(`${backendUrl()}/employees?pageSize=100`, { headers: auth, cache: 'no-store' })
      : null;
  const [res, empRes] = await Promise.all([reportReq, employeesReq]);
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();

  const report: ReportPayload | null = res.ok ? await res.json() : null;
  const employees: EmployeeOption[] =
    kind === 'employee' && empRes?.ok
      ? (((await empRes.json()).data ?? []) as EmployeeOption[])
      : [];

  const dl = (format: string) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}format=${format}`;
  };

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Pelaporan
            <span className="text-primary">/ Pusat Rekapitulasi</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Laporan Rekapitulasi</h1>
          <p className="text-body-sm text-outline">
            Ekspor ke CSV, XLSX, atau PDF untuk keperluan administrasi.
          </p>
        </div>
      </div>

      <nav aria-label="Jenis laporan" className="flex flex-wrap gap-2">
        {REPORT_TABS.map((t) => (
          <Link
            key={t.kind}
            href={`/reports?kind=${t.kind}`}
            aria-current={kind === t.kind ? 'page' : undefined}
            className={
              kind === t.kind
                ? 'rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white'
                : 'rounded-full border border-outline-variant px-4 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low'
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form method="get" className="flex flex-wrap gap-2 text-sm">
        <input type="hidden" name="kind" value={kind} />
        {kind === 'daily' && (
          <input
            type="date"
            name="date"
            defaultValue={sp.date ?? today}
            className={inputClass}
          />
        )}
        {kind === 'monthly' && (
          <input
            type="month"
            name="month"
            defaultValue={sp.month ?? month}
            className={inputClass}
          />
        )}
        {(kind === 'department' || kind === 'late' || kind === 'leaves' || kind === 'employee') && (
          <>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? `${month}-01`}
              className={inputClass}
            />
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? today}
              className={inputClass}
            />
          </>
        )}
        {kind === 'employee' && (
          <select
            name="employeeId"
            defaultValue={sp.employeeId ?? ''}
            className={inputClass}
          >
            <option value="">Pilih karyawan…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.employeeNo})
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 font-medium text-white"
        >
          Tampilkan
        </button>
      </form>

      {report ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/30 pb-4">
            <h2 className="text-headline-md text-on-surface">{report.title}</h2>
            <div className="flex gap-2">
              {(['csv', 'xlsx', 'pdf'] as const).map((f) => (
                <a
                  key={f}
                  href={dl(f)}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md uppercase text-primary transition-colors hover:bg-surface-container-low"
                >
                  {f}
                </a>
              ))}
            </div>
          </div>

          {/* Summary figures sit on their own tiles so the numbers read at a
              glance before anyone scans the table. */}
          <div className="grid grid-cols-2 gap-space-md sm:grid-cols-3 lg:grid-cols-5">
            {report.summary.map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-surface-1"
              >
                <p className="text-label-sm text-outline">{k}</p>
                <p className="tabular mt-1 text-headline-md text-primary">{String(v)}</p>
              </div>
            ))}
          </div>

          <TableShell>
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-outline-variant bg-surface">
                <tr>
                  {report.headers.map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, i) => (
                  // Stable identity first (NIP / tanggal+NIP), index only as
                  // a tiebreak — never index-alone on reorderable data.
                  <Tr key={`${row.slice(0, 3).join('|') || 'empty'}-${i}`}>
                    {row.map((cell, j) => (
                      <Td key={j} tabular={j > 0}>
                        {cell ?? '—'}
                      </Td>
                    ))}
                  </Tr>
                ))}
                {report.rows.length === 0 && (
                  <EmptyRow colSpan={report.headers.length}>Tidak ada data.</EmptyRow>
                )}
              </tbody>
            </table>
          </TableShell>
        </>
      ) : (
        <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-10 text-center text-body-md text-outline">
          {kind === 'employee' && !sp.employeeId
            ? 'Pilih karyawan untuk melihat laporan.'
            : 'Gagal memuat laporan.'}
        </p>
      )}
    </div>
  );
}
