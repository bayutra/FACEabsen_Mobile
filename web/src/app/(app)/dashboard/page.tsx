import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ClipboardCheck,
  Users,
} from 'lucide-react';
import { ACCESS_COOKIE, backendUrl, HOSPITAL_TZ, hospitalToday } from '@/lib/api';
import type { ReportPayload } from '@/lib/reports';

/**
 * The overview is built from the permission-scoped daily reporting endpoint.
 * It deliberately avoids fabricating trends, risk events, or pending reviews.
 */
const CARDS = [
  { label: 'Terjadwal', key: 'Terjadwal', tone: 'neutral', Icon: Users },
  { label: 'Hadir tepat waktu', key: 'Hadir', tone: 'success', Icon: CheckCircle2 },
  { label: 'Terlambat', key: 'Terlambat', tone: 'warning', Icon: Clock3 },
  { label: 'Tidak hadir', key: 'Tidak hadir', tone: 'danger', Icon: CircleAlert },
  { label: 'Izin & cuti', key: 'Izin/cuti', tone: 'info', Icon: CalendarDays },
] as const;

const TONE: Record<string, string> = {
  success: 'text-success-fg bg-success-bg border-success-border',
  warning: 'text-warning-fg bg-warning-bg border-warning-border',
  danger: 'text-danger-fg bg-danger-bg border-danger-border',
  info: 'text-info-fg bg-info-bg border-info-border',
  neutral: 'text-on-surface-variant bg-surface-container-low border-outline-variant/40',
};

function countFor(report: ReportPayload | null, label: string): number | null {
  const entry = report?.summary.find(([key]) => key.toLowerCase() === label.toLowerCase());
  if (!entry) return null;
  const value = Number(entry[1]);
  return Number.isFinite(value) ? value : null;
}

const STATUS: Record<string, { label: string; className: string }> = {
  PRESENT: { label: 'Hadir', className: TONE.success },
  ON_TIME: { label: 'Tepat waktu', className: TONE.success },
  LATE: { label: 'Terlambat', className: TONE.warning },
  VERY_LATE: { label: 'Terlambat', className: TONE.warning },
  ABSENT: { label: 'Tidak hadir', className: TONE.danger },
  ON_LEAVE: { label: 'Izin / cuti', className: TONE.info },
};

export default async function DashboardPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const today = hospitalToday();
  let report: ReportPayload | null = null;
  try {
    const response = await fetch(`${backendUrl()}/reports/daily?date=${today}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (response.ok) report = (await response.json()) as ReportPayload;
  } catch {
    report = null;
  }

  const scheduled = countFor(report, 'Terjadwal');
  const present = countFor(report, 'Hadir');
  const late = countFor(report, 'Terlambat');
  const absent = countFor(report, 'Tidak hadir');
  const onLeave = countFor(report, 'Izin/cuti');
  const checkedIn = present !== null && late !== null ? present + late : null;
  const attendanceRate = scheduled && checkedIn !== null
    ? Math.round((checkedIn / scheduled) * 100)
    : null;
  const number = (value: number | null) => value?.toLocaleString('id-ID') ?? '—';
  // Distribusi Waktu Kedatangan (CSS-only): bucket 30 menit 05:00–10:00
  // dari kolom Masuk baris laporan harian. Di luar rentang tidak dihitung.
  const arrivalBuckets = (() => {
    const labels = Array.from({ length: 10 }, (_, i) => {
      const m = 5 * 60 + i * 30;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    });
    const counts = new Array<number>(10).fill(0);
    let counted = 0;
    for (const row of report?.rows ?? []) {
      const t = String(row[4] ?? '');
      const m = /^(\d{2}):(\d{2})$/.exec(t);
      if (!m) continue;
      const mins = Number(m[1]) * 60 + Number(m[2]);
      const idx = Math.floor((mins - 5 * 60) / 30);
      if (idx < 0 || idx > 9) continue;
      counts[idx] += 1;
      counted += 1;
    }
    const max = Math.max(1, ...counts);
    return { labels, counts, max, counted };
  })();
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString('id-ID', {
    timeZone: HOSPITAL_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-gutter-desktop">
      <section className="flex flex-col justify-between gap-4 border-b border-outline-variant/40 pb-5 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Administrasi RSUD <span aria-hidden>/</span>
            <span className="text-primary">Monitoring Kehadiran</span>
          </p>
          <h1 className="mt-1 max-w-3xl text-headline-xl text-on-surface">
            Ringkasan Presensi Staf Medis
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-body-sm text-outline">
            <CalendarDays className="h-4 w-4" aria-hidden />
            Rekap kehadiran untuk {dateLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports?kind=daily"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Laporan harian <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/attendance"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-body-md-medium text-on-primary transition-colors hover:bg-primary-container"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Buka presensi
          </Link>
        </div>
      </section>

      <section aria-label="Metrik kehadiran hari ini" className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-5">
        {CARDS.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-surface-1"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-body-sm text-on-surface-variant">{card.label}</p>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${TONE[card.tone]}`}>
                <card.Icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="tabular mt-3 text-headline-lg text-on-surface">
              {number(countFor(report, card.key))}
            </p>
            <p className="mt-1 text-label-sm text-outline">staf pada tanggal terpilih</p>
          </article>
        ))}
      </section>

      <section aria-label="Distribusi waktu kedatangan" className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-space-lg shadow-surface-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-headline-md text-on-surface">Distribusi Waktu Kedatangan</h2>
            <p className="mt-1 text-body-sm text-outline">
              Jam masuk staf hari ini per 30 menit · {arrivalBuckets.counted} tercatat
            </p>
          </div>
        </div>
        {arrivalBuckets.counted > 0 ? (
          <div className="mt-5 flex h-32 items-end gap-1.5" role="img" aria-label="Histogram jam kedatangan">
            {arrivalBuckets.counts.map((c, i) => (
              <div key={arrivalBuckets.labels[i]} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch" title={`${arrivalBuckets.labels[i]}: ${c} staf`}>
                <span className="tabular text-label-sm text-on-surface-variant">{c > 0 ? c : ''}</span>
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${Math.max(c > 0 ? 6 : 2, Math.round((c / arrivalBuckets.max) * 100))}%` }}
                />
                <span className="tabular text-[10px] text-outline">{arrivalBuckets.labels[i]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-body-md text-outline">Belum ada jam masuk tercatat hari ini.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-gutter-desktop xl:grid-cols-3">
        <section className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-space-lg shadow-surface-1 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/30 pb-4">
            <div>
              <h2 className="text-headline-md text-on-surface">Kehadiran hari ini</h2>
              <p className="mt-1 text-body-sm text-outline">
                Proporsi staf yang sudah melakukan presensi masuk.
              </p>
            </div>
            <div className="text-right">
              <p className="tabular text-headline-lg text-primary">
                {attendanceRate !== null ? `${attendanceRate}%` : '—'}
              </p>
              <p className="text-label-sm text-outline">sudah presensi</p>
            </div>
          </div>
          <div className="mt-5" aria-label={`${number(checkedIn)} dari ${number(scheduled)} staf telah presensi`}>
            <div className="flex h-3 overflow-hidden rounded-sm bg-surface-container">
              <div className="bg-primary transition-[width]" style={{ width: `${attendanceRate ?? 0}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-body-sm text-on-surface-variant">
              <span><strong className="tabular text-on-surface">{number(checkedIn)}</strong> dari {number(scheduled)} staf</span>
              <span>{number(late)} terlambat</span>
            </div>
          </div>
          {!report ? (
            <p role="status" className="mt-5 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-body-sm text-warning-fg">
              Ringkasan tidak tersedia untuk akun ini atau layanan sedang tidak terjangkau.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-space-lg shadow-surface-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-headline-md text-on-surface">Perlu perhatian</h2>
              <p className="mt-1 text-body-sm text-outline">Status dari rekap jadwal hari ini.</p>
            </div>
            <CircleAlert className="h-5 w-5 text-warning" aria-hidden />
          </div>
          <ul className="mt-4 divide-y divide-outline-variant/30">
            <li className="flex items-center justify-between gap-3 py-3 text-body-sm">
              <span className="text-on-surface-variant">Tidak hadir</span>
              <span className="tabular font-semibold text-danger-fg">{number(absent)}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-3 text-body-sm">
              <span className="text-on-surface-variant">Terlambat</span>
              <span className="tabular font-semibold text-warning-fg">{number(late)}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-3 text-body-sm">
              <span className="text-on-surface-variant">Izin &amp; cuti</span>
              <span className="tabular font-semibold text-on-surface">{number(onLeave)}</span>
            </li>
          </ul>
          <Link href="/attendance" className="mt-2 inline-flex items-center gap-1 text-body-md-medium text-primary hover:underline">
            Tinjau presensi <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest shadow-surface-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 px-space-lg py-space-md">
          <div>
            <h2 className="text-headline-md text-on-surface">Presensi staf terjadwal</h2>
            <p className="mt-0.5 text-body-sm text-outline">Daftar roster dan status masuk untuk hari ini.</p>
          </div>
          <Link href="/attendance" className="inline-flex items-center gap-1 text-body-md-medium text-primary hover:underline">
            Lihat semua <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-outline-variant/40 bg-surface-container-low">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-label-md uppercase text-on-surface-variant">Staf</th>
                <th scope="col" className="px-4 py-3 text-left text-label-md uppercase text-on-surface-variant">Unit</th>
                <th scope="col" className="px-4 py-3 text-left text-label-md uppercase text-on-surface-variant">Shift</th>
                <th scope="col" className="px-4 py-3 text-left text-label-md uppercase text-on-surface-variant">Masuk</th>
                <th scope="col" className="px-4 py-3 text-left text-label-md uppercase text-on-surface-variant">Status</th>
                <th scope="col" className="px-4 py-3 text-right text-label-md uppercase text-on-surface-variant">Risiko</th>
              </tr>
            </thead>
            <tbody>
              {report?.rows.slice(0, 6).map((row, index) => {
                const state = STATUS[String(row[6])] ?? { label: String(row[6] ?? '—'), className: TONE.neutral };
                return (
                  <tr key={`${row[0]}-${index}`} className="border-b border-outline-variant/30 last:border-0 hover:bg-surface">
                    <td className="px-4 py-3">
                      <p className="font-medium text-on-surface">{row[1]}</p>
                      <p className="tabular text-label-sm text-outline">{row[0]}</p>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-on-surface-variant">{row[2]}</td>
                    <td className="px-4 py-3 text-body-sm text-on-surface-variant">{row[3]}</td>
                    <td className="tabular px-4 py-3 text-body-sm text-on-surface-variant">{row[4]}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-label-sm ${state.className}`}>{state.label}</span>
                    </td>
                    <td className="tabular px-4 py-3 text-right text-body-sm text-on-surface-variant">{row[7]}</td>
                  </tr>
                );
              })}
              {(!report || report.rows.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-body-sm text-outline">
                    {report ? 'Belum ada staf terjadwal untuk hari ini.' : 'Data presensi belum dapat dimuat.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {report && report.rows.length > 6 ? (
          <div className="border-t border-outline-variant/30 px-4 py-3 text-body-sm text-outline">
            Menampilkan 6 dari {report.rows.length.toLocaleString('id-ID')} staf terjadwal.
          </div>
        ) : null}
      </section>
    </div>
  );
}
