import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl, HOSPITAL_TZ } from '@/lib/api';
import type { ReportPayload } from '@/lib/reports';
import type { AttendanceListResponse } from '@/lib/attendance';

// Ringkasan tren + risiko (layar admin_dashboard_ringkasan).
// Tren 14 hari dari laporan harian per tanggal (scope mengikuti peran).
// Campuran risiko dari 100 data presensi terbaru hari ini — label jujur
// bila total melebihi itu. Kapasitas unit tidak ditampilkan: tidak ada
// sumber datanya di backend.
interface DayPoint {
  key: string;
  label: string;
  present: number | null;
  late: number | null;
}

function countFor(report: ReportPayload | null, label: string): number | null {
  const entry = report?.summary.find(([key]) => key.toLowerCase() === label.toLowerCase());
  if (!entry) return null;
  const value = Number(entry[1]);
  return Number.isFinite(value) ? value : null;
}

export default async function AdminPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');
  const auth = { Authorization: `Bearer ${token}` };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: HOSPITAL_TZ });
  const days: string[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });

  const settled = await Promise.all(
    days.map(async (date): Promise<DayPoint> => {
      try {
        const res = await fetch(`${backendUrl()}/reports/daily?date=${date}`, {
          headers: auth,
          cache: 'no-store',
        });
        if (!res.ok) return { key: date, label: date.slice(5), present: null, late: null };
        const report = (await res.json()) as ReportPayload;
        return {
          key: date,
          label: date.slice(5),
          present: countFor(report, 'Hadir'),
          late: countFor(report, 'Terlambat'),
        };
      } catch {
        return { key: date, label: date.slice(5), present: null, late: null };
      }
    }),
  );
  const maxDay = Math.max(1, ...settled.map((d) => (d.present ?? 0) + (d.late ?? 0)));

  let low = 0;
  let medium = 0;
  let high = 0;
  let riskTotal: number | null = null;
  let riskCapped = false;
  try {
    const res = await fetch(
      `${backendUrl()}/attendance?from=${today}&to=${today}&pageSize=100`,
      { headers: auth, cache: 'no-store' },
    );
    if (res.ok) {
      const body = (await res.json()) as AttendanceListResponse;
      riskTotal = body.pagination.totalItems;
      riskCapped = riskTotal > body.data.length;
      for (const r of body.data) {
        if (r.riskCategory === 'LOW') low += 1;
        else if (r.riskCategory === 'MEDIUM') medium += 1;
        else if (r.riskCategory === 'HIGH') high += 1;
      }
    }
  } catch {
    riskTotal = null;
  }
  const riskMax = Math.max(1, low, medium, high);
  const riskRows = [
    { label: 'Rendah', value: low, bar: 'bg-success', text: 'text-success-fg' },
    { label: 'Sedang', value: medium, bar: 'bg-warning', text: 'text-warning-fg' },
    { label: 'Tinggi', value: high, bar: 'bg-danger', text: 'text-danger-fg' },
  ];

  return (
    <div className="space-y-gutter">
      <div>
        <p className="flex items-center gap-2 text-label-md text-outline">
          Administrasi RSUD <span aria-hidden>/</span>
          <span className="text-primary">Ringkasan</span>
        </p>
        <h1 className="mt-1 text-headline-xl text-on-surface">Ringkasan Tren & Risiko</h1>
        <p className="mt-1 text-body-sm text-outline">
          14 hari terakhir (cakupan mengikuti peran Anda) + campuran risiko hari ini.
        </p>
      </div>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
        <h2 className="text-headline-md text-on-surface">Tren kehadiran 14 hari</h2>
        <p className="mt-1 text-body-sm text-outline">Hadir (hijau) + terlambat (amber) per hari.</p>
        <div className="mt-5 flex h-40 items-end gap-1.5" role="img" aria-label="Tren kehadiran 14 hari">
          {settled.map((d) => {
            const p = d.present ?? 0;
            const l = d.late ?? 0;
            const known = d.present !== null || d.late !== null;
            return (
              <div
                key={d.key}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch"
                title={`${d.key}: hadir ${d.present ?? '—'}, terlambat ${d.late ?? '—'}`}
              >
                <span className="tabular text-label-sm text-on-surface-variant">
                  {known ? p + l : ''}
                </span>
                <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-sm bg-surface-container">
                  <div className="w-full bg-warning" style={{ height: `${Math.round((l / maxDay) * 100)}%` }} />
                  <div className="w-full bg-success" style={{ height: `${Math.round((p / maxDay) * 100)}%` }} />
                </div>
                <span className="tabular text-[10px] text-outline">{d.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-gutter-desktop xl:grid-cols-2">
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
          <h2 className="text-headline-md text-on-surface">Distribusi risiko hari ini</h2>
          <p className="mt-1 text-body-sm text-outline">
            {riskTotal === null
              ? 'Data risiko tidak tersedia.'
              : riskCapped
                ? `Dari 100 data terbaru (total ${riskTotal}).`
                : `Dari ${riskTotal} data hari ini.`}
          </p>
          <div className="mt-4 space-y-3">
            {riskRows.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">{r.label}</span>
                  <span className={`tabular font-semibold ${r.text}`}>{r.value}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-sm bg-surface-container">
                  <div className={`h-full ${r.bar}`} style={{ width: `${Math.round((r.value / riskMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
          <h2 className="text-headline-md text-on-surface">Peristiwa keamanan</h2>
          <p className="mt-1 text-body-sm text-outline">
            Penolakan presensi, perangkat dicabut, dan login gagal tercatat di audit log.
          </p>
          <Link
            href="/audit?security=true"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488]"
          >
            Buka umpan keamanan
          </Link>
        </section>
      </div>
    </div>
  );
}
