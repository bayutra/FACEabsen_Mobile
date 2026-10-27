'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ErrorBanner, Loading, PageHeader, StatCard, StatusBadge } from '@/components/ui';
import { api, isSuperAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, today } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type Paginated<T> = {
  data?: T[];
  pagination?: { page: number; totalPages: number; totalItems: number };
};

type Report = {
  title?: string;
  generatedAt?: string;
  summary?: [string, string][];
  headers?: string[];
  rows?: string[][];
};

type QueueEntry = {
  href: string;
  label: string;
  description: string;
  count: number;
  tone?: 'warn';
  icon: 'checkCircle' | 'pen' | 'calendar' | 'device';
};

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function countOf(page: Paginated<unknown> | unknown[]): number {
  if (Array.isArray(page)) return page.length;
  if (page.pagination?.totalItems !== undefined) return page.pagination.totalItems;
  return page.data?.length ?? 0;
}

export default function OverviewPage() {
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user?.roles);

  const { data, loading, error, reload } = useResource(
    async () => {
      const [daily, corrections, leaves, review, devices, audit] = await Promise.all([
        safe(api<{ report: Report }>('/reports/daily', { query: { date: today() } }), {
          report: {},
        }),
        safe(api<unknown[]>('/corrections', { query: { status: 'PENDING' } }), []),
        safe(api<unknown[]>('/leaves', { query: { status: 'PENDING' } }), []),
        safe(api<Paginated<unknown>>('/attendance/review', { query: { pageSize: 1 } }), {}),
        superAdmin
          ? safe(api<Paginated<unknown>>('/devices', { query: { status: 'PENDING', pageSize: 1 } }), {})
          : Promise.resolve<Paginated<unknown>>({}),
        superAdmin
          ? safe(api<Paginated<Record<string, unknown>>>('/audit', { query: { pageSize: 6 } }), {})
          : Promise.resolve<Paginated<Record<string, unknown>>>({}),
      ]);
      return {
        report: daily.report ?? {},
        corrections: countOf(corrections),
        leaves: countOf(leaves),
        review: countOf(review),
        devices: countOf(devices),
        audit: audit.data ?? [],
      };
    },
    [superAdmin],
  );

  const queue: QueueEntry[] = [
    {
      href: '/attendance',
      label: 'Tinjauan presensi',
      description: 'Presensi bertanda risiko',
      count: data?.review ?? 0,
      tone: 'warn',
      icon: 'checkCircle',
    },
    {
      href: '/corrections',
      label: 'Koreksi presensi',
      description: 'Permintaan perbaikan jam',
      count: data?.corrections ?? 0,
      tone: 'warn',
      icon: 'pen',
    },
    {
      href: '/leaves',
      label: 'Cuti & izin',
      description: 'Pengajuan belum diputuskan',
      count: data?.leaves ?? 0,
      tone: 'warn',
      icon: 'calendar',
    },
    ...(superAdmin
      ? [
          {
            href: '/devices',
            label: 'Aktivasi perangkat',
            description: 'Perangkat menunggu aktivasi',
            count: data?.devices ?? 0,
            icon: 'device' as const,
          },
        ]
      : []),
  ];

  const totalPending = queue.reduce((total, entry) => total + entry.count, 0);
  const summary = data?.report.summary ?? [];
  const rows = data?.report.rows ?? [];
  const headers = data?.report.headers ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Monitoring kehadiran"
        title="Ringkasan Presensi & Kepatuhan"
        description={`Antrean persetujuan dan rekap presensi per ${formatDate(
          new Date().toISOString(),
        )}. Angka mengikuti data terbaru dari server.`}
        actions={
          <button type="button" className="btn ghost" onClick={reload}>
            <Icon name="refresh" size={16} />
            Muat ulang
          </button>
        }
      />
      <ErrorBanner message={error} />

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <section className="kpi-grid" aria-label="Indikator utama">
            {queue.map((entry) => (
              <StatCard
                key={entry.href}
                label={entry.label}
                value={entry.count}
                hint={entry.count > 0 ? entry.description : 'Tidak ada antrean'}
                tone={entry.count > 0 ? entry.tone : 'success'}
                icon={entry.icon}
                footer={
                  <Link href={entry.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    Buka antrean →
                  </Link>
                }
              />
            ))}
            {summary.map(([label, value]) => (
              <StatCard
                key={label}
                label={label}
                value={value}
                icon="activity"
                hint="Rekap laporan harian"
              />
            ))}
          </section>

          <div className="overview-grid">
            <div className="stack">
              <section className="card">
                <div className="card-head">
                  <div className="card-head-main">
                    <span className="card-head-icon">
                      <Icon name="fileText" size={20} />
                    </span>
                    <div>
                      <h2 className="card-title">
                        {data?.report.title ?? 'Laporan Harian'}
                      </h2>
                      <p className="card-sub">
                        Dibuat {formatDateTime(data?.report.generatedAt)} · presensi
                        tercatat hari ini
                      </p>
                    </div>
                  </div>
                  <div className="card-actions">
                    <Link className="btn soft small" href="/reports">
                      Buka laporan
                    </Link>
                  </div>
                </div>

                {summary.length ? (
                  <div className="summary-strip">
                    {summary.map(([label, value]) => (
                      <div className="summary-item" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted small" style={{ margin: 0 }}>
                    Belum ada ringkasan presensi untuk hari ini.
                  </p>
                )}

                {headers.length && rows.length ? (
                  <div className="table-wrap" style={{ marginTop: 16 }}>
                    <table>
                      <thead>
                        <tr>
                          {headers.map((header) => (
                            <th key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 8).map((row, index) => (
                          <tr key={index}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>

              {superAdmin ? (
                <section className="card">
                  <div className="card-head">
                    <div className="card-head-main">
                      <span className="card-head-icon">
                        <Icon name="list" size={20} />
                      </span>
                      <div>
                        <h2 className="card-title">Audit terbaru</h2>
                        <p className="card-sub">
                          Jejak aksi terakhir pada sistem kepegawaian
                        </p>
                      </div>
                    </div>
                    <div className="card-actions">
                      <Link className="btn ghost small" href="/audit">
                        Semua
                      </Link>
                    </div>
                  </div>

                  {data?.audit.length ? (
                    <ul className="audit-list">
                      {data.audit.map((log) => (
                        <li key={String(log.id)} className="audit-item">
                          <span className="queue-icon">
                            <Icon name="activity" size={16} />
                          </span>
                          <div className="audit-body">
                            <strong>{String(log.action ?? '—')}</strong>
                            <span>
                              {String(log.actorEmail ?? log.actorId ?? '—')} ·{' '}
                              {formatDateTime(log.timestamp)}
                            </span>
                          </div>
                          <StatusBadge status={log.result} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small" style={{ margin: 0 }}>
                      Belum ada aktivitas audit.
                    </p>
                  )}
                </section>
              ) : null}
            </div>

            <aside className="stack">
              <section className="card">
                <div className="card-head">
                  <div className="card-head-main">
                    <span className="card-head-icon">
                      <Icon name="alert" size={20} />
                    </span>
                    <div>
                      <h2 className="card-title">Perlu ditinjau</h2>
                      <p className="card-sub">
                        {totalPending > 0
                          ? `${totalPending} item menunggu keputusan Anda`
                          : 'Tidak ada antrean tertunda'}
                      </p>
                    </div>
                  </div>
                  <span className={`tag ${totalPending > 0 ? 'warn' : ''}`}>
                    {totalPending > 0 ? 'Antrean' : 'Bersih'}
                  </span>
                </div>

                <ul className="queue">
                  {queue.map((entry) => (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        className={`queue-item ${entry.count > 0 ? entry.tone ?? '' : ''}`}
                      >
                        <span className="queue-icon">
                          <Icon name={entry.icon} size={17} />
                        </span>
                        <span className="queue-body">
                          <strong>{entry.label}</strong>
                          <span>{entry.description}</span>
                        </span>
                        <span className="queue-count">{entry.count}</span>
                        <span className="queue-arrow" aria-hidden>
                          <Icon name="chevronRight" size={16} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                {totalPending === 0 ? (
                  <div className="status-line">
                    <span className="status-dot" aria-hidden />
                    Semua pengajuan sudah diputuskan.
                  </div>
                ) : null}
              </section>

              <section className="card">
                <div className="card-head">
                  <div className="card-head-main">
                    <span className="card-head-icon">
                      <Icon name="shield" size={20} />
                    </span>
                    <div>
                      <h2 className="card-title">Cakupan akses</h2>
                      <p className="card-sub">Dibatasi oleh peran akun Anda</p>
                    </div>
                  </div>
                </div>
                <ul className="side-list">
                  <li>
                    <Icon name="users" size={16} />
                    <span>
                      <strong>Kepegawaian.</strong> Data karyawan, unit, shift, dan
                      jadwal sesuai kewenangan.
                    </span>
                  </li>
                  <li>
                    <Icon name="checkCircle" size={16} />
                    <span>
                      <strong>Persetujuan.</strong> Koreksi, tinjauan presensi, cuti &
                      izin tercatat di audit log.
                    </span>
                  </li>
                  <li>
                    <Icon name="fileText" size={16} />
                    <span>
                      <strong>Pelaporan.</strong> Rekap harian sampai heatmap jam,
                      siap diekspor CSV, Excel, dan PDF.
                    </span>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
