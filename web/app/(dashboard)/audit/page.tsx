'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  DataTable,
  ErrorBanner,
  Loading,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, shortId } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  result: string;
  actor?: { email?: string };
  targetType?: string | null;
  targetId?: string | null;
  timestamp?: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AuditPage = {
  data: AuditLog[];
  pagination?: { page: number; totalPages: number; totalItems: number };
};

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [security, setSecurity] = useState(false);
  const [page, setPage] = useState(1);

  const actions = useResource(() => api<string[]>('/audit/actions'), []);
  const stats = useResource(async () => {
    const [all, success, failed, denied] = await Promise.all([
      api<AuditPage>('/audit', { query: { pageSize: 1 } }),
      api<AuditPage>('/audit', { query: { pageSize: 1, result: 'SUCCESS' } }),
      api<AuditPage>('/audit', { query: { pageSize: 1, result: 'FAILED' } }),
      api<AuditPage>('/audit', { query: { pageSize: 1, result: 'DENIED' } }),
    ]);
    return {
      total: all.pagination?.totalItems ?? 0,
      success: success.pagination?.totalItems ?? 0,
      failed: failed.pagination?.totalItems ?? 0,
      denied: denied.pagination?.totalItems ?? 0,
    };
  }, []);
  const list = useResource(
    () =>
      api<AuditPage>('/audit', {
        query: {
          action,
          actorEmail,
          result,
          from,
          to,
          security: security ? true : undefined,
          page,
          pageSize: 25,
        },
      }),
    [action, actorEmail, result, from, to, security, page],
  );

  useEffect(() => {
    setPage(1);
  }, [action, actorEmail, result, from, to, security]);

  const columns: Column<AuditLog>[] = [
    {
      key: 'time',
      header: 'Waktu',
      render: (row) => formatDateTime(row.timestamp),
    },
    {
      key: 'actor',
      header: 'Pelaku',
      render: (row) => (
        <div>
          {row.actor?.email ?? shortId(row.actorId)}
          <div className="muted small">{row.ipAddress ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Aksi',
      render: (row) => <code className="small">{row.action}</code>,
    },
    {
      key: 'target',
      header: 'Target',
      render: (row) => (
        <div className="small">
          {row.targetType ?? '—'}
          <div className="muted small">{shortId(row.targetId)}</div>
        </div>
      ),
    },
    {
      key: 'metadata',
      header: 'Metadata',
      render: (row) =>
        row.metadata ? (
          <code
            className="small"
            title={JSON.stringify(row.metadata, null, 2)}
            style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {JSON.stringify(row.metadata)}
          </code>
        ) : (
          '—'
        ),
    },
    { key: 'result', header: 'Hasil', render: (row) => <StatusBadge status={row.result} /> },
  ];

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Jejak aksi penting: login, approval, perubahan perangkat, dan ekspor data."
        actions={
          <button type="button" className="btn ghost" onClick={list.reload}>
            Muat ulang
          </button>
        }
      />
      <ErrorBanner message={list.error} />

      <div className="kpi-grid">
        <StatCard label="Total log" value={stats.data?.total ?? 0} hint="Seluruh entri audit" icon="list" />
        <StatCard label="Berhasil" value={stats.data?.success ?? 0} hint="Aksi sukses" tone="success" icon="checkCircle" />
        <StatCard label="Gagal" value={stats.data?.failed ?? 0} hint="Aksi gagal" tone={(stats.data?.failed ?? 0) > 0 ? 'danger' : 'default'} icon="alert" />
        <StatCard label="Ditolak" value={stats.data?.denied ?? 0} hint="Aksi ditolak" tone={(stats.data?.denied ?? 0) > 0 ? 'warn' : 'default'} icon="alert" />
      </div>

      <div className="filters">
        <label className="field">
          <span>Aksi</span>
          <Select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">Semua aksi</option>
            {(actions.data ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>Email pelaku</span>
          <TextInput
            value={actorEmail}
            onChange={(event) => setActorEmail(event.target.value)}
            placeholder="admin@rs.test"
          />
        </label>
        <label className="field">
          <span>Hasil</span>
          <Select value={result} onChange={(event) => setResult(event.target.value)}>
            <option value="">Semua</option>
            <option value="SUCCESS">Berhasil</option>
            <option value="FAILED">Gagal</option>
            <option value="DENIED">Ditolak</option>
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
        <label className="checkline" style={{ paddingBottom: 10 }}>
          <input
            type="checkbox"
            checked={security}
            onChange={(event) => setSecurity(event.target.checked)}
          />
          <span>
            Hanya peristiwa keamanan{' '}
            <span className="muted small">
              (login gagal, kunci akun, pencabutan sesi)
            </span>
          </span>
        </label>
      </div>

      {list.loading && !list.data ? (
        <Loading />
      ) : (
        <>
          <div className="card">
            <div className="card-head">
              <div className="card-head-main">
                <span className="card-head-icon">
                  <Icon name="list" size={18} />
                </span>
                <div>
                  <h2 className="card-title">Jejak audit</h2>
                  <p className="card-sub">Aksi penting, login, dan perubahan data.</p>
                </div>
              </div>
              <span className="count-badge">{list.data?.pagination?.totalItems ?? 0} log</span>
            </div>
            <DataTable
              columns={columns}
              rows={list.data?.data ?? []}
              rowKey={(row) => row.id}
              empty="Tidak ada log pada filter ini."
            />
          </div>
          <Pagination
            page={list.data?.pagination?.page ?? page}
            totalPages={list.data?.pagination?.totalPages ?? 1}
            totalItems={list.data?.pagination?.totalItems}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
