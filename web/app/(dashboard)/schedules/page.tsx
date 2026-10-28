'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import {
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Select,
  StatCard,
  TextInput,
} from '@/components/ui';
import { api, isAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, isoDate, today, weekRange } from '@/lib/format';
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

async function loadWeekSchedules(from: string, to: string): Promise<ScheduleEntry[]> {
  const items: ScheduleEntry[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 10) {
    const response = await api<SchedulePage>('/schedules', {
      query: { from, to, page, pageSize: 100 },
    });
    items.push(...(response.data ?? []));
    totalPages = response.pagination?.totalPages ?? 1;
    page += 1;
  }
  return items;
}

function weekDays(from: string) {
  const start = new Date(from + 'T00:00:00');
  const todayIso = isoDate(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = isoDate(date);
    return {
      date: iso,
      weekday: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date),
      day: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date),
      isToday: iso === todayIso,
    };
  });
}

function shiftTone(name: string) {
  const value = name.toLowerCase();
  if (value.includes('malam') || value.includes('night')) return 'night';
  if (value.includes('siang') || value.includes('sore')) return 'evening';
  if (value.includes('libur') || value.includes('off')) return 'off';
  return 'morning';
}

export default function SchedulesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.roles);
  const initial = weekRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');

  const list = useResource(() => loadWeekSchedules(from, to), [from, to]);
  const employees = useResource(() => loadActiveEmployees(), []);
  const shifts = useResource(() => api<ShiftOption[]>('/shifts'), []);

  const days = weekDays(from);
  const entries = list.data ?? [];

  const rows = (() => {
    const map = new Map<string, { name: string; no: string; days: Map<string, ScheduleEntry[]> }>();
    for (const entry of entries) {
      const id = entry.employee?.id ?? entry.id;
      if (!map.has(id)) {
        map.set(id, {
          name: entry.employee?.name ?? '—',
          no: entry.employee?.employeeNo ?? '—',
          days: new Map(),
        });
      }
      const bucket = map.get(id)!;
      const key = entry.workDate ?? '';
      if (!bucket.days.has(key)) bucket.days.set(key, []);
      bucket.days.get(key)!.push(entry);
    }
    return [...map.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  })();

  const filteredRows = rows.filter((row) => {
    if (employeeFilter && row.id !== employeeFilter) return false;
    if (shiftFilter) {
      const hasShift = [...row.days.values()]
        .flat()
        .some((entry) => entry.shift?.name === shiftFilter);
      if (!hasShift) return false;
    }
    return true;
  });

  const uniqueShifts = [...new Set(entries.map((entry) => entry.shift?.name).filter(Boolean))] as string[];
  const uniqueEmployees = rows.length;
  const daysWithEntries = new Set(entries.map((entry) => entry.workDate)).size;

  const moveWeek = (delta: number) => {
    const start = new Date(from + 'T00:00:00');
    start.setDate(start.getDate() + delta * 7);
    const range = weekRange(start);
    setFrom(range.from);
    setTo(range.to);
  };

  const resetWeek = () => {
    const range = weekRange();
    setFrom(range.from);
    setTo(range.to);
  };

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

  return (
    <>
      <PageHeader
        title="Roster Jadwal Shift Mingguan"
        description="Penugasan shift per karyawan per tanggal. Rentang default adalah minggu berjalan."
        actions={
          admin ? (
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              <Icon name="calendar" size={15} />
              Tambah jadwal
            </button>
          ) : null
        }
      />
      <ErrorBanner message={error ?? list.error} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="week-nav">
          <button type="button" className="btn ghost small" onClick={() => moveWeek(-1)} aria-label="Minggu sebelumnya">
            ‹
          </button>
          <strong>
            {formatDate(from)} – {formatDate(to)}
          </strong>
          <button type="button" className="btn ghost small" onClick={() => moveWeek(1)} aria-label="Minggu berikutnya">
            ›
          </button>
          <button type="button" className="btn ghost small" onClick={resetWeek}>
            Minggu ini
          </button>
          <span className="muted small" style={{ marginLeft: 'auto' }}>
            {entries.length} penugasan
          </span>
        </div>
      </div>

      <div className="kpi-grid">
        <StatCard label="Total penugasan" value={entries.length} hint="Pada minggu terpilih" icon="calendar" />
        <StatCard label="Karyawan terjadwal" value={uniqueEmployees} hint="Staf dengan shift" icon="users" />
        <StatCard label="Jenis shift" value={uniqueShifts} hint="Variasi shift minggu ini" icon="clock" />
        <StatCard label="Hari tercakup" value={daysWithEntries} hint="Dari 7 hari" icon="checkCircle" />
      </div>

      <div className="filters">
        <label className="field grow">
          <span>Karyawan</span>
          <Select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="">Semua karyawan</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="field grow">
          <span>Shift</span>
          <Select value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)}>
            <option value="">Semua shift</option>
            {uniqueShifts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        <div className="filters-end">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setEmployeeFilter('');
              setShiftFilter('');
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {list.loading && !list.data ? (
        <Loading />
      ) : filteredRows.length === 0 ? (
        <div className="empty-state">
          <Icon name="calendar" size={26} />
          <strong>Belum ada jadwal pada rentang ini</strong>
          <span>Tambah jadwal baru atau pilih minggu lain.</span>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="roster-wrap">
            <table className="roster">
              <thead>
                <tr>
                  <th>Staf klinis &amp; penugasan</th>
                  {days.map((day) => (
                    <th key={day.date} className={day.isToday ? 'roster-today' : ''}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{day.weekday}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--outline)' }}>{day.day}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="roster-person">
                      <div className="cell-person">
                        <span className="avatar" aria-hidden>
                          {row.name
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() ?? '')
                            .join('') || '—'}
                        </span>
                        <div className="cell-person-text">
                          <strong>{row.name}</strong>
                          <div className="muted small">{row.no}</div>
                        </div>
                      </div>
                    </td>
                    {days.map((day) => {
                      const items = row.days.get(day.date) ?? [];
                      return (
                        <td key={day.date} className={`roster-day ${day.isToday ? 'roster-today' : ''}`}>
                          {items.length === 0 ? (
                            <span className="muted small">—</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {items.map((entry) => (
                                <span
                                  key={entry.id}
                                  className={`shift-chip ${shiftTone(entry.shift?.name ?? '')}`}
                                  title={
                                    admin ? 'Klik × untuk menghapus jadwal ini' : undefined
                                  }
                                >
                                  <strong>{entry.shift?.name ?? '—'}</strong>
                                  <span>
                                    {entry.shift?.startTime}–{entry.shift?.endTime}
                                  </span>
                                  {admin ? (
                                    <button
                                      type="button"
                                      className="shift-chip-remove"
                                      aria-label={`Hapus jadwal ${entry.shift?.name ?? ''}`}
                                      onClick={() => remove(entry)}
                                    >
                                      ×
                                    </button>
                                  ) : null}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
