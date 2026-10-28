'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import {
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatCard,
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

  const toneFor = (name: string) => {
    const value = name.toLowerCase();
    if (value.includes('malam') || value.includes('night')) return 'night';
    if (value.includes('siang') || value.includes('sore')) return 'evening';
    if (value.includes('libur') || value.includes('off')) return 'off';
    return 'morning';
  };

  const shifts = list.data ?? [];
  const overnightCount = shifts.filter((item) => item.overnight).length;
  const avgGrace = shifts.length
    ? Math.round(shifts.reduce((sum, item) => sum + item.gracePeriodMin, 0) / shifts.length)
    : 0;
  const hospitalCount = new Set(shifts.map((item) => item.hospital?.code ?? item.hospital?.name).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Master Shift & Jam Kerja"
        description="Jam kerja, toleransi keterlambatan, dan aturan pulang awal per shift."
        actions={
          admin ? (
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              <Icon name="clock" size={15} />
              Tambah shift
            </button>
          ) : null
        }
      />
      <ErrorBanner message={error ?? list.error} />

      <div className="kpi-grid">
        <StatCard label="Total shift" value={shifts.length} hint="Shift terdaftar" icon="clock" />
        <StatCard label="Lintas hari" value={overnightCount} hint="Shift selesai keesokan hari" icon="calendar" />
        <StatCard label="Rata-rata toleransi" value={`${avgGrace} mnt`} hint="Toleransi masuk" icon="checkCircle" />
        <StatCard label="Rumah sakit" value={hospitalCount || '—'} hint="Rumah sakit dengan shift" icon="building" />
      </div>

      {list.loading && !list.data ? (
        <Loading />
      ) : shifts.length === 0 ? (
        <div className="empty-state">
          <Icon name="clock" size={26} />
          <strong>Belum ada shift</strong>
          <span>Buat shift pertama untuk mulai menyusun jadwal.</span>
        </div>
      ) : (
        <div className="shift-grid">
          {shifts.map((shift) => (
            <article key={shift.id} className={`shift-card ${toneFor(shift.name)}`}>
              <div className="shift-card-head">
                <div className="shift-card-name">
                  <span className="shift-card-icon">
                    <Icon name="clock" size={16} />
                  </span>
                  <div>
                    <h3 className="card-title" style={{ marginBottom: 2 }}>{shift.name}</h3>
                    <p className="card-sub">{shift.hospital?.name ?? 'Rumah sakit'}</p>
                  </div>
                </div>
                {shift.overnight ? (
                  <span className="badge badge-pending">Lintas hari</span>
                ) : (
                  <span className="badge badge-active">Hari sama</span>
                )}
              </div>

              <div className="shift-window">
                <Icon name="clock" size={14} />
                {shift.startTime} – {shift.endTime}
              </div>

              <div className="shift-meta">
                <div className="shift-meta-row">
                  <span>Toleransi masuk</span>
                  <strong>{shift.gracePeriodMin} menit</strong>
                </div>
                <div className="shift-meta-row">
                  <span>Ambang terlambat</span>
                  <strong>{shift.lateThresholdMin} menit</strong>
                </div>
                <div className="shift-meta-row">
                  <span>Ambang pulang awal</span>
                  <strong>{shift.earlyCheckoutThresholdMin} menit</strong>
                </div>
              </div>

              {admin ? (
                <div className="shift-card-foot">
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => setEditing(shift)}
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => remove(shift)}
                  >
                    Hapus
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <div className="card-head-main">
            <span className="card-head-icon">
              <Icon name="checkCircle" size={18} />
            </span>
            <div>
              <h2 className="card-title">Validasi pertukaran shift &amp; matriks kompetensi</h2>
              <p className="card-sub">
                Pertukaran shift dan handover klinis divalidasi melalui persetujuan supervisor di menu Persetujuan.
              </p>
            </div>
          </div>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Shift lintas hari menandakan jadwal yang berakhir keesokan hari. Pastikan toleransi dan ambang sesuai SOP unit sebelum menetapkan jadwal.
        </p>
      </div>

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
