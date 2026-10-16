// STEP 20 — web read model for reports (generic tabular shape).
export interface ReportPayload {
  title: string;
  generatedAt: string;
  summary: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

export type ReportKind = 'daily' | 'monthly' | 'department' | 'employee' | 'late' | 'leaves';

export const REPORT_TABS: Array<{ kind: ReportKind; label: string }> = [
  { kind: 'daily', label: 'Harian' },
  { kind: 'monthly', label: 'Bulanan' },
  { kind: 'department', label: 'Departemen' },
  { kind: 'employee', label: 'Karyawan' },
  { kind: 'late', label: 'Terlambat' },
  { kind: 'leaves', label: 'Izin & Cuti' },
];

export interface ReportQuery {
  kind: ReportKind;
  date?: string;
  month?: string;
  from?: string;
  to?: string;
  employeeId?: string;
}

/** Builds the BFF path + query for a report (drops empties). */
export function toReportPath(q: ReportQuery): string {
  const params = new URLSearchParams();
  if (q.kind === 'daily' && q.date) params.set('date', q.date);
  if (q.kind === 'monthly' && q.month) params.set('month', q.month);
  if ((q.kind === 'department' || q.kind === 'late' || q.kind === 'leaves') && q.from) {
    params.set('from', q.from);
  }
  if ((q.kind === 'department' || q.kind === 'late' || q.kind === 'leaves') && q.to) {
    params.set('to', q.to);
  }
  if (q.kind === 'employee') {
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
  }
  const base =
    q.kind === 'employee' && q.employeeId
      ? `/api/reports/employee/${encodeURIComponent(q.employeeId)}`
      : `/api/reports/${q.kind}`;
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}
