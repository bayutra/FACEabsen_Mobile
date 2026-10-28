'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  DataTable,
  ErrorBanner,
  Field,
  InfoBanner,
  Loading,
  PageHeader,
  Select,
  StatCard,
  TextInput,
  type Column,
} from '@/components/ui';
import { api, downloadFile } from '@/lib/api';
import { endOfMonthIso, formatDateTime, monthKey, startOfMonthIso, today } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type ReportKind =
  | 'daily'
  | 'monthly'
  | 'late'
  | 'leaves'
  | 'department'
  | 'employee'
  | 'heatmap';

type Report = {
  title?: string;
  generatedAt?: string;
  summary?: [string, string][];
  headers?: string[];
  rows?: string[][];
  days?: string[];
  hours?: number[];
  cells?: number[][];
  maxCount?: number;
  totalCheckIns?: number;
  lateCheckIns?: number;
  peak?: { day?: string; hour?: number; count?: number };
};

type EmployeeOption = { id: string; name: string; employeeNo?: string };

const KIND_LABELS: Record<ReportKind, string> = {
  daily: 'Harian',
  monthly: 'Bulanan',
  late: 'Keterlambatan',
  leaves: 'Cuti & Izin',
  department: 'Per Unit',
  employee: 'Per Karyawan',
  heatmap: 'Heatmap Jam',
};

async function loadEmployeeOptions(): Promise<EmployeeOption[]> {
  try {
    const response = await api<{
      data?: EmployeeOption[];
    }>('/employees', { query: { pageSize: 100, status: 'ACTIVE' } });
    return response.data ?? [];
  } catch {
    const team = await api<EmployeeOption[]>('/supervisor/team');
    return team;
  }
}

export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('daily');
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(monthKey());
  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo] = useState(endOfMonthIso());
  const [employeeId, setEmployeeId] = useState('');
  const [applied, setApplied] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const employees = useResource(() => loadEmployeeOptions(), []);

  useEffect(() => {
    if (!employeeId && employees.data?.length) {
      setEmployeeId(employees.data[0].id);
    }
  }, [employees.data, employeeId]);

  const params = () => {
    switch (kind) {
      case 'daily':
        return { date };
      case 'monthly':
        return { month };
      case 'employee':
        return { employeeId, from, to };
      default:
        return { from, to };
    }
  };

  const path = () => {
    switch (kind) {
      case 'daily':
        return '/reports/daily';
      case 'monthly':
        return '/reports/monthly';
      case 'late':
        return '/reports/late';
      case 'leaves':
        return '/reports/leaves';
      case 'department':
        return '/reports/department';
      case 'employee':
        return `/reports/employee/${employeeId}`;
      case 'heatmap':
        return '/reports/heatmap';
    }
  };

  const report = useResource(
    async () => {
      if (kind === 'employee' && !employeeId) return {} as Report;
      return api<Report>(path(), { query: params() });
    },
    [kind, date, month, from, to, employeeId, applied],
  );

  const exportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setExporting(format);
    setExportError(null);
    try {
      await downloadFile(
        path(),
        { ...params(), format },
        `laporan-${kind}.${format}`,
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  };

  const resetFilters = () => {
    setDate(today());
    setMonth(monthKey());
    setFrom(startOfMonthIso());
    setTo(endOfMonthIso());
    setApplied((value) => value + 1);
  };

  const columns: Column<string[]>[] = (report.data?.headers ?? []).map(
    (header, index) => ({
      key: String(index),
      header,
      render: (row: string[]) => row[index] ?? '—',
    }),
  );

  return (
    <>
      <PageHeader
        title="Pusat Laporan & Rekapitulasi"
        description="Rekap presensi, keterlambatan, cuti, per unit, dan heatmap jam. Ekspor tersedia dalam CSV, Excel, dan PDF."
        actions={
          <>
            {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
              <button
                key={format}
                type="button"
                className="btn ghost"
                disabled={exporting !== null}
                onClick={() => exportReport(format)}
              >
                {exporting === format ? 'Menyiapkan…' : `Ekspor ${format.toUpperCase()}`}
              </button>
            ))}
          </>
        }
      />
      <ErrorBanner message={report.error ?? exportError} />
      <InfoBanner>
        Laporan mengikuti hak akses dan filter yang dipilih. Pilih modul di katalog,
        sesuaikan periode, lalu tekan "Terapkan".
      </InfoBanner>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="card-head-main">
            <span className="card-head-icon">
              <Icon name="fileText" size={18} />
            </span>
            <div>
              <h2 className="card-title">Katalog modul laporan</h2>
              <p className="card-sub">Pilih jenis laporan untuk dijalankan.</p>
            </div>
          </div>
          <span className="count-badge">{Object.keys(KIND_LABELS).length} kategori</span>
        </div>
        <div className="catalog">
          {(Object.keys(KIND_LABELS) as ReportKind[]).map((item) => (
            <button
              key={item}
              type="button"
              className="catalog-btn"
              aria-pressed={kind === item}
              onClick={() => setKind(item)}
            >
              {KIND_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="filters">
        {kind === 'daily' ? (
          <label className="field">
            <span>Tanggal</span>
            <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        ) : null}

        {kind === 'monthly' ? (
          <label className="field">
            <span>Bulan</span>
            <TextInput type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        ) : null}

        {kind !== 'daily' && kind !== 'monthly' ? (
          <>
            <label className="field">
              <span>Dari</span>
              <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="field">
              <span>Sampai</span>
              <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </>
        ) : null}

        {kind === 'employee' ? (
          <label className="field grow">
            <span>Karyawan</span>
            <Select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              {(employees.data ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.employeeNo ? ` (${employee.employeeNo})` : ''}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <div className="filters-end">
          <button
            type="button"
            className="btn"
            onClick={() => setApplied((value) => value + 1)}
            disabled={kind === 'employee' && !employeeId}
          >
            Terapkan
          </button>
          <button type="button" className="btn ghost" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      {report.loading && !report.data ? (
        <Loading />
      ) : report.data ? (
        <div className="stack">
          {report.data.summary?.length ? (
            <div className="kpi-grid">
              {report.data.summary.map(([label, value]) => (
                <StatCard key={label} label={label} value={value} />
              ))}
            </div>
          ) : null}

          <div className="card">
            <div className="card-head">
              <div className="card-head-main">
                <span className="card-head-icon">
                  <Icon name="list" size={18} />
                </span>
                <div>
                  <h2 className="card-title">{report.data.title ?? 'Laporan'}</h2>
                  <p className="card-sub">Dibuat {formatDateTime(report.data.generatedAt)}</p>
                </div>
              </div>
              <span className="count-badge">{report.data.rows?.length ?? 0} baris</span>
            </div>

            {report.data.cells?.length ? (
              <Heatmap report={report.data} />
            ) : null}

            {columns.length > 0 ? (
              <DataTable
                columns={columns}
                rows={report.data.rows ?? []}
                rowKey={(_, index) => String(index)}
                empty="Laporan kosong untuk periode ini."
              />
            ) : report.data.cells?.length ? null : (
              <div className="empty-state">Tidak ada data untuk periode ini.</div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Heatmap({ report }: { report: Report }) {
  const days = report.days ?? [];
  const hours = report.hours ?? [];
  const cells = report.cells ?? [];
  const max = Math.max(report.maxCount ?? 0, 1);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 className="section-title">Heatmap check-in</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="muted small">
          Total {report.totalCheckIns ?? 0} check-in · Terlambat {report.lateCheckIns ?? 0}
        </span>
        {report.peak?.day ? (
          <span className="muted small">
            Puncak: {report.peak.day} {report.peak.hour ?? ''}:00 ({report.peak.count ?? 0})
          </span>
        ) : null}
      </div>
      <div className="heatmap-wrap">
        <table className="heatmap">
          <thead>
            <tr>
              <th />
              {hours.map((hour) => (
                <th key={hour}>{hour}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, rowIndex) => (
              <tr key={day}>
                <th scope="row">{day}</th>
                {hours.map((hour, columnIndex) => {
                  const count = cells[rowIndex]?.[columnIndex] ?? 0;
                  const alpha = count === 0 ? 0 : 0.15 + (count / max) * 0.75;
                  return (
                    <td
                      key={hour}
                      className={count > 0 ? 'has-value' : ''}
                      style={{
                        background:
                          count > 0 ? `rgba(15, 118, 110, ${alpha})` : undefined,
                      }}
                      title={`${day} ${hour}:00 — ${count} check-in`}
                    >
                      {count || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
