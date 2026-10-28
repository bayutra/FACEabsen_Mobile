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
  StatCard,
  StatusBadge,
  TextInput,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, typeLabel } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type Leave = {
  id: string;
  type: string;
  status: string;
  startDate?: string;
  endDate?: string;
  reason: string;
  requestedAt?: string;
  reviewNote?: string | null;
  employee?: { name?: string; employeeNo?: string };
};

export default function LeavesPage() {
  const [status, setStatus] = useState('PENDING');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Leave | null>(null);

  const { data, loading, error, reload } = useResource(
    () => api<Leave[]>('/leaves', { query: { status, from, to } }),
    [status, from, to],
  );

  const stats = useResource(
    () => api<Leave[]>('/leaves', { query: { from, to } }),
    [from, to],
  );

  const decide = async (decision: 'APPROVE' | 'REJECT', note: string) => {
    if (!selected) return;
    await api(`/leaves/${selected.id}/${decision.toLowerCase()}`, {
      method: 'POST',
      body: note ? { reviewNote: note } : {},
    });
    reload();
  };

  const columns: Column<Leave>[] = [
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
    { key: 'type', header: 'Jenis', render: (row) => typeLabel(row.type) },
    {
      key: 'range',
      header: 'Tanggal',
      render: (row) => (
        <div>
          {formatDate(row.startDate)} – {formatDate(row.endDate)}
          <div className="muted small">Diajukan {formatDateTime(row.requestedAt)}</div>
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
        title="Cuti & Izin"
        description="Setujui atau tolak pengajuan cuti, sakit, izin, dan dinas karyawan."
        actions={
          <button type="button" className="btn ghost" onClick={reload}>
            Muat ulang
          </button>
        }
      />
      <ErrorBanner message={error} />

      {(() => {
        const all = stats.data ?? data ?? [];
        const pending = all.filter((item) => item.status === 'PENDING').length;
        const approved = all.filter((item) => item.status === 'APPROVED').length;
        const rejected = all.filter((item) => item.status === 'REJECTED').length;
        const cancelled = all.filter((item) => item.status === 'CANCELLED').length;
        return (
          <div className="kpi-grid">
            <StatCard label="Menunggu" value={pending} hint="Perlu ditinjau" tone={pending > 0 ? 'warn' : 'default'} icon="calendar" />
            <StatCard label="Disetujui" value={approved} hint="Pengajuan disetujui" tone="success" icon="checkCircle" />
            <StatCard label="Ditolak" value={rejected} hint="Pengajuan ditolak" tone={rejected > 0 ? 'danger' : 'default'} icon="alert" />
            <StatCard label="Dibatalkan" value={cancelled} hint="Dibatalkan karyawan" icon="list" />
          </div>
        );
      })()}

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
        <label className="field">
          <span>Dari</span>
          <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>Sampai</span>
          <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <div className="filters-end">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setStatus('PENDING');
              setFrom('');
              setTo('');
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {loading && !data ? (
        <Loading />
      ) : (
        <div className="card">
          <div className="card-head">
            <div className="card-head-main">
              <span className="card-head-icon">
                <Icon name="calendar" size={18} />
              </span>
              <div>
                <h2 className="card-title">Pengajuan cuti &amp; izin</h2>
                <p className="card-sub">Setujui atau tolak pengajuan karyawan.</p>
              </div>
            </div>
            <span className="count-badge">{data?.length ?? 0} pengajuan</span>
          </div>
          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={(row) => row.id}
            empty="Tidak ada pengajuan pada filter ini."
          />
        </div>
      )}

      <ReviewModal
        open={selected !== null}
        title="Tinjau pengajuan cuti/izin"
        description={
          selected ? (
            <div className="card">
              <strong>{selected.employee?.name ?? 'Karyawan'}</strong>
              <div className="muted small">
                {typeLabel(selected.type)} · {formatDate(selected.startDate)} –{' '}
                {formatDate(selected.endDate)}
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
