'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
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

type ChangeRequest = {
  id: string;
  status: string;
  reason: string;
  reasonNote?: string | null;
  requestedAt?: string;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  employee?: { name?: string; employeeNo?: string };
  oldDevice?: { id?: string; deviceName?: string; platform?: string } | null;
  newDevice?: { id?: string; deviceName?: string; platform?: string } | null;
};

export default function DeviceChangePage() {
  const [status, setStatus] = useState('PENDING');
  const [selected, setSelected] = useState<ChangeRequest | null>(null);

  const { data, loading, error, reload } = useResource(
    () => api<ChangeRequest[]>('/device-change', { query: { status } }),
    [status],
  );

  const decide = async (decision: 'APPROVE' | 'REJECT', note: string) => {
    if (!selected) return;
    await api(`/device-change/${selected.id}/${decision.toLowerCase()}`, {
      method: 'POST',
      body: note ? { reviewNote: note } : {},
    });
    reload();
  };

  const columns: Column<ChangeRequest>[] = [
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
      key: 'devices',
      header: 'Perangkat',
      render: (row) => (
        <div className="small">
          <div>
            <span className="muted">Lama: </span>
            {row.oldDevice?.deviceName ?? '—'}
          </div>
          <div>
            <span className="muted">Baru: </span>
            {row.newDevice?.deviceName ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Alasan',
      render: (row) => (
        <div style={{ maxWidth: 260 }}>
          {typeLabel(row.reason)}
          {row.reasonNote ? <div className="muted small">{row.reasonNote}</div> : null}
        </div>
      ),
    },
    {
      key: 'requested',
      header: 'Diajukan',
      render: (row) => formatDateTime(row.requestedAt),
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
        title="Penggantian Perangkat"
        description="Permintaan penggantian perangkat oleh karyawan. Persetujuan mencabut perangkat lama dan mengaktifkan yang baru."
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
        <div className="card">
          <div className="card-head">
            <div className="card-head-main">
              <span className="card-head-icon">
                <Icon name="device" size={18} />
              </span>
              <div>
                <h2 className="card-title">Permintaan penggantian perangkat</h2>
                <p className="card-sub">Persetujuan mencabut perangkat lama.</p>
              </div>
            </div>
            <span className="count-badge">{data?.length ?? 0} permintaan</span>
          </div>
          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={(row) => row.id}
            empty="Tidak ada permintaan penggantian pada filter ini."
          />
        </div>
      )}

      <ReviewModal
        open={selected !== null}
        title="Tinjau penggantian perangkat"
        approveLabel="Setujui & aktifkan"
        description={
          selected ? (
            <div className="card">
              <strong>{selected.employee?.name ?? 'Karyawan'}</strong>
              <div className="muted small">
                {typeLabel(selected.reason)} · diajukan {formatDateTime(selected.requestedAt)}
              </div>
              <p style={{ marginBottom: 0 }}>
                {selected.reasonNote ?? 'Tanpa catatan tambahan.'}
              </p>
            </div>
          ) : null
        }
        onClose={() => setSelected(null)}
        onDecide={decide}
      />
    </>
  );
}
