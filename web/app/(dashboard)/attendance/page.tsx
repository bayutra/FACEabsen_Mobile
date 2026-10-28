'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { ReviewModal } from '@/components/ReviewModal';
import {
  DataTable,
  ErrorBanner,
  Loading,
  PageHeader,
  StatCard,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, statusLabel, typeLabel } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type ReviewItem = {
  id: string;
  workDate?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInStatus?: string | null;
  riskScore?: number | null;
  riskCategory?: string | null;
  employee?: {
    name?: string;
    employeeNo?: string;
    department?: { name?: string };
  };
  shift?: { name?: string; startTime?: string; endTime?: string };
};

type PageResponse = {
  data?: ReviewItem[];
  pagination?: { totalItems?: number };
};

export default function AttendanceReviewPage() {
  const [selected, setSelected] = useState<ReviewItem | null>(null);

  const { data, loading, error, reload } = useResource(
    async () => {
      const response = await api<PageResponse | ReviewItem[]>('/attendance/review', {
        query: { pageSize: 50 },
      });
      const rows = Array.isArray(response) ? response : response.data ?? [];
      return rows;
    },
    [],
  );

  const decide = async (decision: 'APPROVE' | 'REJECT', note: string) => {
    if (!selected) return;
    await api(`/attendance/${selected.id}/review`, {
      method: 'POST',
      body: { decision, ...(note ? { note } : {}) },
    });
    reload();
  };

  const columns: Column<ReviewItem>[] = [
    {
      key: 'employee',
      header: 'Karyawan',
      render: (row) => (
        <div>
          <strong>{row.employee?.name ?? '—'}</strong>
          <div className="muted small">
            {row.employee?.employeeNo ?? '—'}
            {row.employee?.department?.name ? ` · ${row.employee.department.name}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (row) => (
        <div>
          {row.shift?.name ?? '—'}
          <div className="muted small">
            {row.shift?.startTime && row.shift?.endTime
              ? `${row.shift.startTime}–${row.shift.endTime}`
              : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'workDate',
      header: 'Tanggal',
      render: (row) => (
        <div>
          {formatDate(row.workDate)}
          <div className="muted small">
            Masuk {formatDateTime(row.checkInAt)} · Pulang {formatDateTime(row.checkOutAt)}
          </div>
        </div>
      ),
    },
    {
      key: 'checkIn',
      header: 'Status masuk',
      render: (row) => statusLabel(row.checkInStatus),
    },
    {
      key: 'risk',
      header: 'Risiko',
      render: (row) => (
        <div>
          <StatusBadge status={row.riskCategory ?? 'LOW'} />
          <div className="muted small">
            {typeof row.riskScore === 'number' ? `Skor ${row.riskScore}` : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" className="btn ghost small" onClick={() => setSelected(row)}>
          Tinjau
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Tinjauan Presensi"
        description="Presensi yang ditandai sistem karena risiko sedang menunggu validasi supervisor."
        actions={
          <button type="button" className="btn ghost" onClick={reload}>
            Muat ulang
          </button>
        }
      />
      <ErrorBanner message={error} />

      {(() => {
        const rows = data ?? [];
        const high = rows.filter((item) => item.riskCategory === 'HIGH').length;
        const medium = rows.filter((item) => item.riskCategory === 'MEDIUM').length;
        const low = rows.filter((item) => item.riskCategory === 'LOW' || !item.riskCategory).length;
        return (
          <div className="kpi-grid">
            <StatCard label="Menunggu tinjauan" value={rows.length} hint="Presensi berisiko sedang" icon="list" />
            <StatCard label="Risiko tinggi" value={high} hint="Perlu validasi segera" tone={high > 0 ? 'danger' : 'default'} icon="alert" />
            <StatCard label="Risiko sedang" value={medium} hint="Menunggu supervisor" tone={medium > 0 ? 'warn' : 'default'} icon="alert" />
            <StatCard label="Risiko rendah" value={low} hint="Informasi tambahan" icon="checkCircle" />
          </div>
        );
      })()}

      {loading && !data ? (
        <Loading />
      ) : (
        <div className="card">
          <div className="card-head">
            <div className="card-head-main">
              <span className="card-head-icon">
                <Icon name="checkCircle" size={18} />
              </span>
              <div>
                <h2 className="card-title">Presensi menunggu tinjauan</h2>
                <p className="card-sub">Validasi presensi berisiko sedang.</p>
              </div>
            </div>
            <span className="count-badge">{data?.length ?? 0} data</span>
          </div>
          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={(row) => row.id}
            empty="Tidak ada presensi yang menunggu tinjauan."
          />
        </div>
      )}

      <ReviewModal
        open={selected !== null}
        title="Tinjau presensi"
        approveLabel="Validasi"
        rejectLabel="Tandai tidak sah"
        description={
          selected ? (
            <div className="card">
              <strong>{selected.employee?.name ?? 'Karyawan'}</strong>
              <div className="muted small">
                {formatDate(selected.workDate)} · {selected.shift?.name ?? 'Shift'}
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <StatusBadge status={selected.riskCategory ?? 'LOW'} />
                <span className="muted small">{typeLabel(selected.riskCategory)}</span>
                {typeof selected.riskScore === 'number' ? (
                  <span className="muted small">Skor {selected.riskScore}</span>
                ) : null}
              </div>
            </div>
          ) : null
        }
        onClose={() => setSelected(null)}
        onDecide={decide}
      />
    </>
  );
}
