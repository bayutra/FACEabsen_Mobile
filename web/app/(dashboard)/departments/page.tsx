'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import {
  DataTable,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  PageHeader,
  Select,
  StatCard,
  TextInput,
  type Column,
} from '@/components/ui';
import { api, isAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/useResource';

type Department = {
  id: string;
  name: string;
  hospitalId?: string;
  hospital?: { id?: string; code?: string; name?: string };
};

type Hospital = { id: string; code: string; name: string };

export default function DepartmentsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.roles);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useResource(() => api<Department[]>('/departments'), []);
  const hospitals = useResource(() => api<Hospital[]>('/hospitals'), []);

  const remove = async (department: Department) => {
    if (!window.confirm(`Hapus unit ${department.name}?`)) return;
    setError(null);
    try {
      await api(`/departments/${department.id}`, { method: 'DELETE' });
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const columns: Column<Department>[] = [
    {
      key: 'name',
      header: 'Unit',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div className="muted small">{row.id}</div>
        </div>
      ),
    },
    {
      key: 'hospital',
      header: 'Rumah sakit',
      render: (row) =>
        row.hospital?.name ?? row.hospitalId ?? '—',
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
        title="Unit Kerja"
        description="Struktur unit rumah sakit yang dipakai untuk penempatan karyawan dan laporan."
        actions={
          admin ? (
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              + Unit
            </button>
          ) : null
        }
      />
      <ErrorBanner message={error ?? list.error} />

      <div className="kpi-grid">
        <StatCard label="Total unit" value={list.data?.length ?? 0} hint="Unit terdaftar" icon="building" />
        <StatCard label="Rumah sakit" value={hospitals.data?.length ?? 0} hint="Rumah sakit dengan unit" icon="building" />
      </div>

      {list.loading && !list.data ? (
        <Loading />
      ) : (
        <div className="card">
          <div className="card-head">
            <div className="card-head-main">
              <span className="card-head-icon">
                <Icon name="building" size={18} />
              </span>
              <div>
                <h2 className="card-title">Unit kerja</h2>
                <p className="card-sub">Struktur unit rumah sakit.</p>
              </div>
            </div>
            <span className="count-badge">{list.data?.length ?? 0} unit</span>
          </div>
          <DataTable
            columns={columns}
            rows={list.data ?? []}
            rowKey={(row) => row.id}
            empty="Belum ada unit."
          />
        </div>
      )}

      <DepartmentForm
        open={creating || editing !== null}
        department={editing}
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

function DepartmentForm({
  open,
  department,
  hospitals,
  onClose,
  onSaved,
}: {
  open: boolean;
  department: Department | null;
  hospitals: Hospital[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [hospitalId, setHospitalId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHospitalId(department?.hospitalId ?? department?.hospital?.id ?? hospitals[0]?.id ?? '');
    setName(department?.name ?? '');
    setError(null);
  }, [open, department, hospitals]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (department) {
        await api(`/departments/${department.id}`, {
          method: 'PATCH',
          body: { name },
        });
      } else {
        await api('/departments', {
          method: 'POST',
          body: { hospitalId, name },
        });
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
      title={department ? `Ubah ${department.name}` : 'Tambah unit'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="department-form" className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="department-form" onSubmit={submit} className="stack">
        {error ? <div className="alert error">{error}</div> : null}
        {!department ? (
          <Field label="Rumah sakit">
            <Select
              value={hospitalId}
              onChange={(event) => setHospitalId(event.target.value)}
              required
            >
              {hospitals.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.code ? `${hospital.code} · ${hospital.name}` : hospital.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Nama unit">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
      </form>
    </Modal>
  );
}
