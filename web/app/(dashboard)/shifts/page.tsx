'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  DataTable,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
  TextInput,
  type Column,
} from '@/components/ui';
import { api, isAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/useResource';

type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  gracePeriodMin: number;
  lateThresholdMin: number;
  earlyCheckoutThresholdMin: number;
  hospital?: { name?: string; code?: string };
};

export default function ShiftsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.roles);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useResource(() => api<Shift[]>('/shifts'), []);
  const hospitals = useResource(
    () => api<{ id: string; code: string; name: string }[]>('/hospitals'),
    [],
  );

  const remove = async (shift: Shift) => {
    if (!window.confirm(`Hapus shift ${shift.name}?`)) return;
    setError(null);
    try {
      await api(`/shifts/${shift.id}`, { method: 'DELETE' });
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const columns: Column<Shift>[] = [
    {
      key: 'name',
      header: 'Shift',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div className="muted small">{row.hospital?.name ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Jam',
      render: (row) => (
        <div>
          {row.startTime}–{row.endTime}
          <div className="muted small">
            {row.overnight ? (
              <span className="badge badge-pending">Lintas hari</span>
            ) : (
              'Hari sama'
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'thresholds',
      header: 'Toleransi',
      render: (row) => (
        <div className="small">
          <div>Masuk: {row.gracePeriodMin} menit</div>
          <div>Terlambat: {row.lateThresholdMin} menit</div>
          <div>Pulang awal: {row.earlyCheckoutThresholdMin} menit</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        admin ? (
          <div className="cell-actions">
            <button type="button" className="btn ghost small" onClick={() => setEditing(row)}>
              Ubah
            </button>
            <button type="button" className="btn ghost small" onClick={() => remove(row)}>
              Hapus
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Shift Kerja"
        description="Jam kerja, toleransi keterlambatan, dan aturan pulang awal per shift."
        actions={
          admin ? (
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              + Shift
            </button>
          ) : null
        }
      />
      <ErrorBanner message={error ?? list.error} />
      {list.loading && !list.data ? (
        <Loading />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data ?? []}
          rowKey={(row) => row.id}
          empty="Belum ada shift."
        />
      )}

      <ShiftForm
        open={creating || editing !== null}
        shift={editing}
        hospitals={hospitals.data ?? []}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          list.reload();
        }}
      />
    </>
  );
}

function ShiftForm({
  open,
  shift,
  hospitals,
  onClose,
  onSaved,
}: {
  open: boolean;
  shift: Shift | null;
  hospitals: { id: string; code: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [hospitalId, setHospitalId] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [overnight, setOvernight] = useState(false);
  const [grace, setGrace] = useState(15);
  const [late, setLate] = useState(30);
  const [early, setEarly] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHospitalId(hospitals[0]?.id ?? '');
    setName(shift?.name ?? '');
    setStartTime(shift?.startTime ?? '07:00');
    setEndTime(shift?.endTime ?? '15:00');
    setOvernight(shift?.overnight ?? false);
    setGrace(shift?.gracePeriodMin ?? 15);
    setLate(shift?.lateThresholdMin ?? 30);
    setEarly(shift?.earlyCheckoutThresholdMin ?? 15);
    setError(null);
  }, [open, shift, hospitals]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name,
      startTime,
      endTime,
      overnight,
      gracePeriodMin: grace,
      lateThresholdMin: late,
      earlyCheckoutThresholdMin: early,
    };
    try {
      if (shift) {
        await api(`/shifts/${shift.id}`, { method: 'PATCH', body: payload });
      } else {
        await api('/shifts', { method: 'POST', body: { ...payload, hospitalId } });
      }
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
      title={shift ? `Ubah shift ${shift.name}` : 'Tambah shift'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="shift-form" className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="shift-form" onSubmit={submit} className="stack">
        {error ? <div className="alert error">{error}</div> : null}
        {!shift ? (
          <Field label="Rumah sakit">
            <select
              className="input"
              value={hospitalId}
              onChange={(event) => setHospitalId(event.target.value)}
              required
            >
              {hospitals.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.code ? `${hospital.code} · ${hospital.name}` : hospital.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Nama shift">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <div className="row">
          <Field label="Jam mulai">
            <TextInput
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </Field>
          <Field label="Jam selesai">
            <TextInput
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </Field>
        </div>
        <label className="row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={overnight}
            onChange={(event) => setOvernight(event.target.checked)}
          />
          Shift lintas hari (selesai keesokan hari)
        </label>
        <div className="row">
          <Field label="Toleransi masuk (menit)">
            <TextInput
              type="number"
              min={0}
              value={grace}
              onChange={(event) => setGrace(Number(event.target.value))}
            />
          </Field>
          <Field label="Ambang terlambat (menit)">
            <TextInput
              type="number"
              min={0}
              value={late}
              onChange={(event) => setLate(Number(event.target.value))}
            />
          </Field>
          <Field label="Ambang pulang awal (menit)">
            <TextInput
              type="number"
              min={0}
              value={early}
              onChange={(event) => setEarly(Number(event.target.value))}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
