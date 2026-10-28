'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  DataTable,
  ErrorBanner,
  Loading,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  TextInput,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import {
  formatDate,
  formatDateTime,
  startOfMonthIso,
  statusLabel,
  today,
} from '@/lib/format';
import { useResource } from '@/lib/useResource';

type TeamMember = {
  id: string;
  name: string;
  employeeNo: string;
  position?: string | null;
  department?: { name?: string } | null;
  days?: Record<string, string>;
};

type TeamSummary = {
  from?: string;
  to?: string;
  totals?: {
    members?: number;
    present?: number;
    late?: number;
    absent?: number;
    onLeave?: number;
  };
  members?: TeamMember[];
};

type TeamAttendance = {
  id: string;
  workDate?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInStatus?: string | null;
  shift?: { name?: string };
  employee?: { name?: string; employeeNo?: string };
};

type MemberDetail = {
  member?: TeamMember;
  recent?: TeamAttendance[];
};

function countStatus(member: TeamMember, status: string): number {
  return Object.values(member.days ?? {}).filter((value) => value === status).length;
}

export default function TeamPage() {
  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo] = useState(today());
  const [selected, setSelected] = useState<string | null>(null);

  const summary = useResource(
    () => api<TeamSummary>('/supervisor/summary', { query: { from, to } }),
    [from, to],
  );
  const attendance = useResource(
    () => api<TeamAttendance[]>('/supervisor/attendance', { query: { from, to } }),
    [from, to],
  );
  const detail = useResource(
    async () =>
      selected ? api<MemberDetail>(`/supervisor/team/${selected}`) : null,
    [selected],
  );

  const members = summary.data?.members ?? [];

  const memberColumns: Column<TeamMember>[] = [
    {
      key: 'member',
      header: 'Anggota',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div className="muted small">
            {row.employeeNo}
            {row.department?.name ? ` · ${row.department.name}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'present',
      header: 'Hadir',
      render: (row) => countStatus(row, 'PRESENT'),
    },
    {
      key: 'late',
      header: 'Terlambat',
      render: (row) => countStatus(row, 'LATE'),
    },
    {
      key: 'absent',
      header: 'Absen',
      render: (row) => countStatus(row, 'ABSENT'),
    },
    {
      key: 'leave',
      header: 'Cuti',
      render: (row) => countStatus(row, 'ON_LEAVE'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setSelected(row.id)}
        >
          Detail
        </button>
      ),
    },
  ];

  const attendanceColumns: Column<TeamAttendance>[] = [
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
    { key: 'date', header: 'Tanggal', render: (row) => formatDate(row.workDate) },
    { key: 'shift', header: 'Shift', render: (row) => row.shift?.name ?? '—' },
    {
      key: 'checkIn',
      header: 'Masuk',
      render: (row) => (
        <div>
          {formatDateTime(row.checkInAt)}
          <div className="muted small">{statusLabel(row.checkInStatus)}</div>
        </div>
      ),
    },
    { key: 'checkOut', header: 'Pulang', render: (row) => formatDateTime(row.checkOutAt) },
  ];

  return (
    <>
      <PageHeader
        title="Tim Saya"
        description="Ringkasan kehadiran anggota tim dan presensi terbaru pada rentang tanggal."
        actions={
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              summary.reload();
              attendance.reload();
            }}
          >
            Muat ulang
          </button>
        }
      />
      <ErrorBanner message={summary.error ?? attendance.error} />

      <div className="filters">
        <label className="field">
          <span>Dari</span>
          <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>Sampai</span>
          <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>

      <div className="grid stats">
        <StatCard label="Anggota tim" value={summary.data?.totals?.members ?? members.length} />
        <StatCard label="Hadir" value={summary.data?.totals?.present ?? 0} tone="success" />
        <StatCard label="Terlambat" value={summary.data?.totals?.late ?? 0} tone="warn" />
        <StatCard label="Absen" value={summary.data?.totals?.absent ?? 0} tone="danger" />
        <StatCard label="Cuti/izin" value={summary.data?.totals?.onLeave ?? 0} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div className="card-head-main">
            <span className="card-head-icon">
              <Icon name="users" size={18} />
            </span>
            <div>
              <h2 className="card-title">Anggota & rekap hari</h2>
              <p className="card-sub">Kehadiran anggota tim pada rentang tanggal.</p>
            </div>
          </div>
          <span className="count-badge">{members.length} anggota</span>
        </div>
        {summary.loading && !summary.data ? (
          <Loading />
        ) : (
          <DataTable
            columns={memberColumns}
            rows={members}
            rowKey={(row) => row.id}
            empty="Belum ada anggota tim."
          />
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-head-main">
            <span className="card-head-icon">
              <Icon name="list" size={18} />
            </span>
            <div>
              <h2 className="card-title">Presensi terbaru</h2>
              <p className="card-sub">Presensi anggota tim pada rentang tanggal.</p>
            </div>
          </div>
          <span className="count-badge">{attendance.data?.length ?? 0} data</span>
        </div>
        {attendance.loading && !attendance.data ? (
          <Loading />
        ) : (
          <DataTable
            columns={attendanceColumns}
            rows={attendance.data ?? []}
            rowKey={(row) => row.id}
            empty="Belum ada presensi pada rentang ini."
          />
        )}
      </div>

      <Modal
        open={selected !== null}
        title={detail.data?.member?.name ?? 'Detail anggota'}
        onClose={() => setSelected(null)}
      >
        {detail.loading && !detail.data ? (
          <Loading />
        ) : detail.data ? (
          <>
            <div className="row">
              <StatusBadge status={detail.data.member?.position ?? 'ACTIVE'} />
              <span className="muted small">
                {detail.data.member?.employeeNo ?? '—'} ·{' '}
                {detail.data.member?.department?.name ?? 'Tanpa unit'}
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Shift</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.data.recent ?? []).map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.workDate)}</td>
                      <td>{row.shift?.name ?? '—'}</td>
                      <td>{formatDateTime(row.checkInAt)}</td>
                      <td>{formatDateTime(row.checkOutAt)}</td>
                      <td>{statusLabel(row.checkInStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">Tidak ada detail.</p>
        )}
      </Modal>
    </>
  );
}
