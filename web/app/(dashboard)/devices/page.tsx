'use client';

import { useEffect, useState } from 'react';
import { ActionModal } from '@/components/ActionModal';
import {
  DataTable,
  ErrorBanner,
  Loading,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  TextInput,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type Device = {
  id: string;
  status: string;
  platform: string;
  deviceName?: string | null;
  appVersion?: string | null;
  installationId?: string | null;
  registeredAt?: string;
  lastSeenAt?: string | null;
  revokeReason?: string | null;
  trustScore?: number;
  trustLevel?: string;
  employee?: { name?: string; employeeNo?: string; department?: { name?: string } };
};

type DevicePage = {
  data: Device[];
  pagination?: { page: number; totalPages: number; totalItems: number };
};

export default function DevicesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revoking, setRevoking] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useResource(
    () =>
      api<DevicePage>('/devices', {
        query: { status, search, page, pageSize: 20 },
      }),
    [status, search, page],
  );

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const run = async (action: () => Promise<unknown>, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setError(null);
    try {
      await action();
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const columns: Column<Device>[] = [
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
      key: 'device',
      header: 'Perangkat',
      render: (row) => (
        <div>
          {row.deviceName ?? '—'}
          <div className="muted small">
            {row.platform} · aplikasi {row.appVersion ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'registered',
      header: 'Terdaftar / terakhir aktif',
      render: (row) => (
        <div>
          {formatDateTime(row.registeredAt)}
          <div className="muted small">{formatDateTime(row.lastSeenAt)}</div>
        </div>
      ),
    },
    {
      key: 'trust',
      header: 'Trust',
      render: (row) => (
        <div>
          <StatusBadge status={row.trustLevel ?? 'LOW'} />
          <div className="muted small">Skor {row.trustScore ?? 0}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={row.status} />
          {row.revokeReason ? <div className="muted small">{row.revokeReason}</div> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="cell-actions">
          {row.status === 'PENDING' ? (
            <button
              type="button"
              className="btn small"
              onClick={() =>
                run(
                  () => api(`/devices/${row.id}/activate`, { method: 'POST', body: {} }),
                  `Aktifkan perangkat ${row.deviceName ?? row.id}?`,
                )
              }
            >
              Aktifkan
            </button>
          ) : null}
          {row.status === 'ACTIVE' ? (
            <>
              <button type="button" className="btn ghost small" onClick={() => setRevoking(row)}>
                Cabut
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() =>
                  run(
                    () => api(`/devices/${row.id}/mark-lost`, { method: 'POST' }),
                    `Tandai perangkat ${row.deviceName ?? row.id} hilang?`,
                  )
                }
              >
                Tandai hilang
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Perangkat"
        description="Perangkat terikat karyawan: aktivasi perangkat baru, cabut akses, dan tandai hilang."
        actions={
          <button type="button" className="btn ghost" onClick={list.reload}>
            Muat ulang
          </button>
        }
      />
      <ErrorBanner message={error ?? list.error} />

      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <label className="field grow">
          <span>Cari</span>
          <TextInput
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Nama karyawan, NIP, atau perangkat"
          />
        </label>
        <label className="field">
          <span>Status</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Semua</option>
            <option value="PENDING">Menunggu</option>
            <option value="ACTIVE">Aktif</option>
            <option value="REVOKED">Dicabut</option>
            <option value="LOST">Hilang</option>
            <option value="REPLACED">Diganti</option>
          </Select>
        </label>
        <button type="submit" className="btn ghost">
          Terapkan
        </button>
      </form>

      {list.loading && !list.data ? (
        <Loading />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={list.data?.data ?? []}
            rowKey={(row) => row.id}
            empty="Tidak ada perangkat pada filter ini."
          />
          <Pagination
            page={list.data?.pagination?.page ?? page}
            totalPages={list.data?.pagination?.totalPages ?? 1}
            totalItems={list.data?.pagination?.totalItems}
            onChange={setPage}
          />
        </>
      )}

      <ActionModal
        open={revoking !== null}
        title="Cabut akses perangkat"
        danger
        confirmLabel="Cabut perangkat"
        description={
          revoking ? (
            <p style={{ margin: 0 }}>
              Sesi aktif pada <strong>{revoking.deviceName ?? revoking.id}</strong> akan
              langsung dihentikan.
            </p>
          ) : null
        }
        fieldLabel="Alasan (opsional)"
        placeholder="Contoh: perangkat dilaporkan hilang"
        onClose={() => setRevoking(null)}
        onSubmit={async (reason) => {
          if (!revoking) return;
          await api(`/devices/${revoking.id}/revoke`, {
            method: 'POST',
            body: reason ? { reason } : {},
          });
          list.reload();
        }}
      />
    </>
  );
}
