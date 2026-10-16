import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, notFound, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import type { AttendanceDetail } from '@/lib/attendance';
import { Badge } from '@/components/ui/surface';

// Detail bukti presensi: telemetri yang benar-benar tersimpan server
// (waktu, shift, titik tap GPS + akurasi, verdict geofence, perangkat,
// risiko). Liveness/faceScore tidak disimpan per baris — tidak ditampilkan.
export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${backendUrl()}/attendance/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error('Gagal memuat detail presensi');

  const a = (await res.json()) as AttendanceDetail;

  const fmtDT = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '—';

  const duration = (() => {
    if (!a.checkInAt || !a.checkOutAt) return null;
    const ms = new Date(a.checkOutAt).getTime() - new Date(a.checkInAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return `${h} jam ${m} menit`;
  })();

  const coord = (lat?: number | null, lon?: number | null) =>
    lat !== null && lat !== undefined && lon !== null && lon !== undefined
      ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
      : null;

  const checkInCoord = coord(a.checkInLat, a.checkInLon);
  const checkOutCoord = coord(a.checkOutLat, a.checkOutLon);

  return (
    <div className="space-y-gutter">
      <div>
        <p className="flex items-center gap-2 text-label-md text-outline">
          Kehadiran
          <span className="text-primary">/ Detail Bukti</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-headline-xl text-on-surface">Bukti Presensi Digital</h1>
          {a.checkInStatus === 'ON_TIME' ? (
            <Badge tone="success">Tepat waktu</Badge>
          ) : (
            <Badge tone="warning">{a.checkInStatus ?? '—'}</Badge>
          )}
          {a.needsReview && <Badge tone="warning">Perlu review</Badge>}
        </div>
        <p className="tabular text-body-sm text-outline">
          {a.employee?.name ?? '—'} · {a.employee?.employeeNo ?? ''} · ID {a.id}
        </p>
      </div>

      <div className="grid gap-gutter md:grid-cols-2">
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
          <h2 className="text-headline-md text-on-surface">Waktu Presensi</h2>
          <dl className="mt-3 space-y-2 text-body-md">
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Masuk</dt>
              <dd className="tabular text-right">{fmtDT(a.checkInAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Pulang</dt>
              <dd className="tabular text-right">{fmtDT(a.checkOutAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Durasi efektif</dt>
              <dd className="tabular text-right">{duration ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Shift</dt>
              <dd className="text-right">
                {a.shift ? `${a.shift.name} · ${a.shift.startTime} → ${a.shift.endTime}` : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
          <h2 className="text-headline-md text-on-surface">Titik Tap Geofence</h2>
          <dl className="mt-3 space-y-2 text-body-md">
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Masuk</dt>
              <dd className="tabular text-right">{checkInCoord ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Akurasi GPS</dt>
              <dd className="tabular text-right">
                {a.checkInAccuracy !== null && a.checkInAccuracy !== undefined
                  ? `±${Math.round(a.checkInAccuracy)} m`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Verdict radius</dt>
              <dd className="text-right">
                {a.geofencePass === true ? (
                  <Badge tone="success">Dalam radius</Badge>
                ) : a.geofencePass === false ? (
                  <Badge tone="danger">Di luar radius</Badge>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Pulang</dt>
              <dd className="tabular text-right">{checkOutCoord ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
          <h2 className="text-headline-md text-on-surface">Perangkat & Risiko</h2>
          <dl className="mt-3 space-y-2 text-body-md">
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Perangkat</dt>
              <dd className="text-right">
                {a.device?.deviceName ?? a.deviceId ?? '—'}
                {a.device?.platform ? ` · ${a.device.platform}` : ''}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-outline">Skor risiko</dt>
              <dd className="tabular text-right">
                {a.riskScore ?? '—'} · {a.riskCategory ?? '—'}
              </dd>
            </div>
            {a.notes && (
              <div className="flex justify-between gap-4">
                <dt className="text-outline">Catatan</dt>
                <dd className="text-right">{a.notes}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <Link
        href="/attendance"
        className="inline-flex h-10 items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-md-medium text-on-surface transition-colors hover:bg-surface-container-low"
      >
        ← Kembali ke Rekap
      </Link>
    </div>
  );
}
