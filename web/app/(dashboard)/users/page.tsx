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
  Pagination,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, roleLabel } from '@/lib/format';
import { useResource } from '@/lib/useResource';

const ROLES = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'];

type AdminUser = {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  lockedUntil?: string | null;
  failedLoginAttempts?: number | null;
  createdAt?: string;
  employee?: {
    name?: string;
    employeeNo?: string;
    status?: string;
    department?: { name?: string };
  } | null;
};

type UserPage = {
  data: AdminUser[];
  pagination?: { page: number; totalPages: number; totalItems: number };
};

export default function UsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [editingRoles, setEditingRoles] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useResource(async () => {
    const [all, active] = await Promise.all([
      api<UserPage>('/users', { query: { pageSize: 1 } }),
      api<UserPage>('/users', { query: { pageSize: 1, active: true } }),
    ]);
    return {
      total: all.pagination?.totalItems ?? 0,
      active: active.pagination?.totalItems ?? 0,
    };
  }, []);

  const list = useResource(
    () =>
      api<UserPage>('/users', {
        query: {
          search,
          role,
          isActive: activeFilter === '' ? undefined : activeFilter === 'true',
          page,
          pageSize: 20,
        },
      }),
    [search, role, activeFilter, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search, role, activeFilter]);

  const act = async (action: () => Promise<unknown>, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setError(null);
    try {
      await action();
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'email',
      header: 'Akun',
      render: (row) => (
        <div>
          <strong>{row.email}</strong>
          <div className="muted small">
            {row.employee?.name ?? 'Tanpa profil karyawan'}
            {row.employee?.employeeNo ? ` · ${row.employee.employeeNo}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Peran',
      render: (row) => (
        <div className="row" style={{ gap: 4 }}>
          {row.roles.map((item) => (
            <span key={item} className="badge">
              {roleLabel(item)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Unit',
      render: (row) => row.employee?.department?.name ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
          {row.lockedUntil ? (
            <div className="muted small">Terkunci s/d {formatDateTime(row.lockedUntil)}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="cell-actions">
          {!row.isActive ? (
            <button
              type="button"
              className="btn small"
              onClick={() =>
                act(
                  () => api(`/users/${row.id}/approve`, { method: 'POST' }),
                  `Setujui akun ${row.email}?`,
                )
              }
            >
              Setujui
            </button>
          ) : null}
          <button type="button" className="btn ghost small" onClick={() => setEditingRoles(row)}>
            Peran
          </button>
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              act(
                () =>
                  api(`/users/${row.id}`, {
                    method: 'PATCH',
                    body: { isActive: !row.isActive },
                  }),
                row.isActive
                  ? `Nonaktifkan ${row.email}?`
                  : `Aktifkan ${row.email}?`,
              )
            }
          >
            {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button type="button" className="btn ghost small" onClick={() => setResetting(row)}>
            Reset sandi
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pengguna & Peran"
        description="Akun login dashboard/aplikasi, peran akses, persetujuan akun, dan reset kata sandi."
        actions={
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            + Pengguna
          </button>
        }
      />
      <ErrorBanner message={error ?? list.error} />

      <div className="kpi-grid">
        <StatCard label="Total pengguna" value={stats.data?.total ?? 0} hint="Akun terdaftar" icon="users" />
        <StatCard label="Aktif" value={stats.data?.active ?? 0} hint="Dapat login" tone="success" icon="checkCircle" />
        <StatCard label="Nonaktif" value={Math.max((stats.data?.total ?? 0) - (stats.data?.active ?? 0), 0)} hint="Dinonaktifkan" tone="warn" icon="alert" />
        <StatCard label="Pada filter" value={list.data?.pagination?.totalItems ?? 0} hint="Hasil filter" icon="list" />
      </div>

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
            placeholder="Email atau nama karyawan"
          />
        </label>
        <label className="field">
          <span>Peran</span>
          <Select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Semua</option>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {roleLabel(item)}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>Status</span>
          <Select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
          >
            <option value="">Semua</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
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
          <div className="card">
            <div className="card-head">
              <div className="card-head-main">
                <span className="card-head-icon">
                  <Icon name="users" size={18} />
                </span>
                <div>
                  <h2 className="card-title">Pengguna & peran</h2>
                  <p className="card-sub">Akun login dashboard/aplikasi.</p>
                </div>
              </div>
              <span className="count-badge">{list.data?.pagination?.totalItems ?? 0} pengguna</span>
            </div>
            <DataTable
              columns={columns}
              rows={list.data?.data ?? []}
              rowKey={(row) => row.id}
              empty="Tidak ada pengguna pada filter ini."
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

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          list.reload();
        }}
      />

      <RolesModal
        user={editingRoles}
        onClose={() => setEditingRoles(null)}
        onSaved={() => {
          setEditingRoles(null);
          list.reload();
        }}
      />

      <ResetPasswordModal
        user={resetting}
        onClose={() => setResetting(null)}
        onSaved={() => setResetting(null)}
      />
    </>
  );
}

function CreateUserModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['EMPLOYEE']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setPassword('');
    setRoles(['EMPLOYEE']);
    setError(null);
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/users', { method: 'POST', body: { email, password, roles } });
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
      title="Tambah pengguna"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="create-user-form" className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={submit} className="stack">
        {error ? <div className="alert error">{error}</div> : null}
        <Field label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Kata sandi awal">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Field label="Peran">
          <div className="row">
            {ROLES.map((role) => (
              <label key={role} className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(event) =>
                    setRoles((current) =>
                      event.target.checked
                        ? [...current, role]
                        : current.filter((item) => item !== role),
                    )
                  }
                />
                {roleLabel(role)}
              </label>
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}

function RolesModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setRoles(user.roles);
    setError(null);
  }, [user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body: { roles } });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={user !== null}
      title={`Peran ${user?.email ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="roles-form" className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="roles-form" onSubmit={submit} className="stack">
        {error ? <div className="alert error">{error}</div> : null}
        <div className="row">
          {ROLES.map((role) => (
            <label key={role} className="row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={(event) =>
                  setRoles((current) =>
                    event.target.checked
                      ? [...current, role]
                      : current.filter((item) => item !== role),
                  )
                }
              />
              {roleLabel(role)}
            </label>
          ))}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Peran dashboard: Supervisor, Admin, Super Admin. Akun tanpa peran itu
          tetap bisa memakai aplikasi mobile.
        </p>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassword('');
    setError(null);
  }, [user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/users/${user.id}/reset-password`, {
        method: 'POST',
        body: { password },
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
      open={user !== null}
      title={`Reset kata sandi ${user?.email ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="reset-password-form" className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Reset'}
          </button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={submit} className="stack">
        {error ? <div className="alert error">{error}</div> : null}
        <Field label="Kata sandi baru" hint="Minimal 8 karakter; sesi lain akan dicabut.">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
