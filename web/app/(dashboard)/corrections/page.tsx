'use client';

import { useState } from 'react';
import { ReviewModal } from '@/components/ReviewModal';
import {
  DataTable,
  ErrorBanner,
  Loading,
  PageHeader,
  Select,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, typeLabel } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type Correction = {
  id: string;
  type: string;
  status: string;
  reason: string;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  requestedAt?: string;
  reviewNote?: string | null;
  employee?: { name?: string; employeeNo?: string };
  attendance?: {
    workDate?: string;
    checkInAt?: string | null;
    checkOutAt?: string | null;
  };
};

export default function CorrectionsPage() {
  const [status, setStatus] = useState('PENDING');
  const [selected, setSelected] = useState<Correction | null>(null);

  const { data, loading, error, reload } = useResource(
    () => api<Correction[]>('/corrections', { query: { status } }),
    [status],
  );

  const rows = data ?? [];

  const decide = async (decision: 'APPROVE' | 'REJECT', note: string) => {
    if (!selected) return;
    await api(`/corrections/${selected.id}/${decision.toLowerCase()}`, {
      method: 'POST',
      body: note ? { reviewNote: note } : {},
    });
    reload();
  };

  const columns: Column<Correction>[] = [
    {
      key: 'employee',
      header: 'Karyawan',
      render: (row) => (
        <div>
          <strong>{row.employee?.name ?? '—'}</strong>
          <div className="muted small">{row.employee?.employeeNo ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'workDate',
      header: 'Tanggal presensi',
      render: (row) => (
        <div>
          {formatDateTime(row.attendance?.workDate)}
          <div className="muted small">
            Masuk {formatDateTime(row.attendance?.checkInAt)} · Pulang{' '}
            {formatDateTime(row.attendance?.checkOutAt)}
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Jenis', render: (row) => typeLabel(row.type) },
    {
      key: 'requested',
      header: 'Diajukan',
      render: (row) => (
        <div>
          {row.requestedCheckIn ? (
            <div>Masuk: {formatDateTime(row.requestedCheckIn)}</div>
          ) : null}
          {row.requestedCheckOut ? (
            <div>Pulang: {formatDateTime(row.requestedCheckOut)}</div>
          ) : null}
          <div className="muted small">{formatDateTime(row.requestedAt)}</div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Alasan',
      render: (row) => (
        <div style={{ maxWidth: 280 }}>
          {row.reason || '—'}
          {row.reviewNote ? (
            <div className="muted small">Catatan: {row.reviewNote}</div>
          ) : null}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PENDING' ? (
          <button type="button" className="btn ghost small" onClick={() => setSelected(row)}>
            Tinjau
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Koreksi Presensi"
        description="Tinjau permintaan perbaikan jam masuk/pulang. Persetujuan langsung memperbarui presensi karyawan."
        actions={
          <button type="button" className="btn ghost" onClick={reload}>
            Muat ulang
          </button>
        }
      />
      <ErrorBanner message={error} />

      <div className="filters">
        <label className="field">
          <span>Status</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="PENDING">Menunggu</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
            <option value="CANCELLED">Dibatalkan</option>
            <option value="">Semua</option>
          </Select>
        </label>
      </div>

      {loading && !data ? (
        <Loading />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty="Tidak ada permintaan koreksi pada filter ini."
        />
      )}

      <ReviewModal
        open={selected !== null}
        title="Tinjau koreksi presensi"
        description={
          selected ? (
            <div className="card">
              <strong>{selected.employee?.name ?? 'Karyawan'}</strong>
              <div className="muted small">
                {typeLabel(selected.type)} · {formatDateTime(selected.attendance?.workDate)}
              </div>
              <p style={{ marginBottom: 0 }}>{selected.reason}</p>
            </div>
          ) : null
        }
        onClose={() => setSelected(null)}
        onDecide={decide}
      />
    </>
  );
}
