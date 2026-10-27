'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  DataTable,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TextInput,
  type Column,
} from '@/components/ui';
import { api, isAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, today, weekRange } from '@/lib/format';
import { useResource } from '@/lib/useResource';

type ScheduleEntry = {
  id: string;
  workDate?: string;
  shiftId: string;
  shift?: { id?: string; name?: string; startTime?: string; endTime?: string };
  employee?: { id?: string; name?: string; employeeNo?: string };
};

type SchedulePage = {
  data: ScheduleEntry[];
  pagination?: { page: number; totalPages: number; totalItems: number };
};

type EmployeeOption = {
  id: string;
  name: string;
  employeeNo: string;
  department?: { name?: string };
};

type ShiftOption = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

async function loadActiveEmployees(): Promise<EmployeeOption[]> {
  const items: EmployeeOption[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 20) {
    const response = await api<{
      data?: EmployeeOption[];
      pagination?: { totalPages?: number };
    }>('/employees', { query: { page, pageSize: 100, status: 'ACTIVE' } });
    items.push(...(response.data ?? []));
    totalPages = response.pagination?.totalPages ?? 1;
    page += 1;
  }
  return items;
}

export default function SchedulesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.roles);
  const initial = weekRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useResource(
    () =>
      api<SchedulePage>('/schedules', {
        query: { from, to, page, pageSize: 25 },
      }),
    [from, to, page],
  );
  const employees = useResource(() => loadActiveEmployees(), []);
  const shifts = useResource(() => api<ShiftOption[]>('/shifts'), []);

  useEffect(() => {
    setPage(1);
  }, [from, to]);

  const remove = async (entry: ScheduleEntry) => {
    if (!window.confirm('Hapus jadwal ini?')) return;
    setError(null);
    try {
      await api(`/schedules/${entry.id}`, { method: 'DELETE' });
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const columns: Column<ScheduleEntry>[] = [
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
      key: 'actions',
      header: '',
      render: (row) =>
        admin ? (
          <button type="button" className="btn ghost small" onClick={() => remove(row)}>
            Hapus
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Jadwal Shift"
        description="Penugasan shift per karyawan per tanggal. Rentang default adalah minggu berjalan."
        actions={
          admin ? (
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              + Jadwal
            </button>
          ) : null
        }
      />
      <ErrorBanner message={error ?? list.error} />

      <div className="filters">
        <label className="field">
          <span>Dari</span>
          <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>Sampai</span>
          <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const current = weekRange();
            setFrom(current.from);
            setTo(current.to);
          }}
        >
          Minggu ini
        </button>
      </div>

      {list.loading && !list.data ? (
        <Loading />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={list.data?.data ?? []}
            rowKey={(row) => row.id}
            empty="Belum ada jadwal pada rentang ini."
          />
          <Pagination
            page={list.data?.pagination?.page ?? page}
            totalPages={list.data?.pagination?.totalPages ?? 1}
            totalItems={list.data?.pagination?.totalItems}
            onChange={setPage}
          />
        </>
      )}

      <ScheduleForm
        open={open}
        employees={employees.data ?? []}
        shifts={shifts.data ?? []}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          list.reload();
        }}
      />
    </>
  );
}

function ScheduleForm({
  open,
  employees,
  shifts,
  onClose,
  onSaved,
}: {
  open: boolean;
  employees: EmployeeOption[];
  shifts: ShiftOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [workDate, setWorkDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(employees[0]?.id ?? '');
    setShiftId(shifts[0]?.id ?? '');
    setWorkDate(today());
    setError(null);
  }, [open, employees, shifts]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/schedules', {
        method: 'POST',
        body: { employeeId, shiftId, workDate },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Tambah jadwal shift"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="schedule-form" className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit} className="stack">
        {error ? <div className="alert error">{error}</div> : null}
        <Field label="Karyawan">
          <Select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            required
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.employeeNo})
                {employee.department?.name ? ` · ${employee.department.name}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shift">
          <Select value={shiftId} onChange={(event) => setShiftId(event.target.value)} required>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name} · {shift.startTime}–{shift.endTime}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal kerja">
          <TextInput
            type="date"
            value={workDate}
            onChange={(event) => setWorkDate(event.target.value)}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
