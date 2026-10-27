'use client';

import { useEffect, useState } from 'react';
import {
  DataTable,
  ErrorBanner,
  Field,
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
        title="Laporan"
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

      <div className="filters">
        <label className="field">
          <span>Jenis laporan</span>
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as ReportKind)}
          >
            {(Object.keys(KIND_LABELS) as ReportKind[]).map((item) => (
              <option key={item} value={item}>
                {KIND_LABELS[item]}
              </option>
            ))}
          </Select>
        </label>

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

        <button
          type="button"
          className="btn"
          onClick={() => setApplied((value) => value + 1)}
          disabled={kind === 'employee' && !employeeId}
        >
          Tampilkan
        </button>
      </div>

      {report.loading && !report.data ? (
        <Loading />
      ) : report.data ? (
        <div className="stack">
          <div className="card">
            <h2 style={{ margin: 0, fontSize: 16 }}>
              {report.data.title ?? 'Laporan'}
            </h2>
            <div className="muted small">
              Dibuat {formatDateTime(report.data.generatedAt)}
            </div>
            {report.data.summary?.length ? (
              <div className="grid stats" style={{ marginTop: 14 }}>
                {report.data.summary.map(([label, value]) => (
                  <StatCard key={label} label={label} value={value} />
                ))}
              </div>
            ) : null}
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
    <div className="card">
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
