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
  StatusBadge,
  TextInput,
  type Column,
} from '@/components/ui';
import { api, isAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/useResource';

type Employee = {
  id: string;
  employeeNo: string;
  name: string;
  email: string;
  status: string;
  phone?: string | null;
  position?: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  supervisor?: { name?: string } | null;
  user?: { roles?: string[] } | null;
};

type Department = { id: string; name: string };
type EmployeePage = {
  data: Employee[];
  pagination?: { page: number; totalPages: number; totalItems: number };
};

const ROLES = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN'];

export default function EmployeesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.roles);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departments = useResource(
    () => api<Department[]>('/departments'),
    [],
  );

  const list = useResource(
    () =>
      api<EmployeePage>('/employees', {
        query: { search, status, departmentId, page, pageSize: 20 },
      }),
    [search, status, departmentId, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search, status, departmentId]);

  const reloadAll = () => {
    list.reload();
    departments.reload();
  };

  const deactivate = async (employee: Employee) => {
    if (!window.confirm(`Nonaktifkan akun ${employee.name}?`)) return;
    setError(null);
    try {
      await api(`/employees/${employee.id}/deactivate`, { method: 'POST' });
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: 'employee',
      header: 'Karyawan',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div className="muted small">
            {row.employeeNo} · {row.email}
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Unit / Jabatan',
      render: (row) => (
        <div>
          {row.department?.name ?? '—'}
          <div className="muted small">{row.position ?? '—'}</div>
        </div>
      ),
    },
    { key: 'phone', header: 'Telepon', render: (row) => row.phone ?? '—' },
    {
      key: 'supervisor',
      header: 'Atasan',
      render: (row) => row.supervisor?.name ?? '—',
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="cell-actions">
          <button type="button" className="btn ghost small" onClick={() => setEditing(row)}>
            Ubah
          </button>
          {admin && row.status === 'ACTIVE' ? (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => deactivate(row)}
            >
              Nonaktifkan
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Karyawan"
        description="Data induk karyawan beserta unit, jabatan, dan status kepegawaian."
        actions={
          admin ? (
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              + Karyawan
            </button>
          ) : null
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
            placeholder="Nama, NIP, atau email"
          />
        </label>
        <label className="field">
          <span>Status</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Semua</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </Select>
        </label>
        <label className="field">
          <span>Unit</span>
          <Select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">Semua unit</option>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
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
            empty="Tidak ada karyawan pada filter ini."
          />
          <Pagination
            page={list.data?.pagination?.page ?? page}
            totalPages={list.data?.pagination?.totalPages ?? 1}
            totalItems={list.data?.pagination?.totalItems}
            onChange={setPage}
          />
        </>
      )}

      <EmployeeForm
        open={creating || editing !== null}
        employee={editing}
        departments={departments.data ?? []}
        canCreate={admin}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          reloadAll();
        }}
      />
    </>
  );
}

function EmployeeForm({
  open,
  employee,
  departments,
  canCreate,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee: Employee | null;
  departments: Department[];
  canCreate: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeNo, setEmployeeNo] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roles, setRoles] = useState<string[]>(['EMPLOYEE']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeNo(employee?.employeeNo ?? '');
    setName(employee?.name ?? '');
    setEmail(employee?.email ?? '');
    setPassword('');
    setPhone(employee?.phone ?? '');
    setPosition(employee?.position ?? '');
    setDepartmentId(employee?.departmentId ?? '');
    setRoles(employee?.user?.roles?.length ? employee.user.roles : ['EMPLOYEE']);
    setError(null);
  }, [open, employee]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (employee) {
        await api(`/employees/${employee.id}`, {
          method: 'PATCH',
          body: {
            name,
            ...(canCreate ? { email } : {}),
            phone,
            position,
            ...(departmentId ? { departmentId } : {}),
          },
        });
      } else {
        await api('/employees', {
          method: 'POST',
          body: {
            employeeNo,
            name,
            email,
            password,
            ...(phone ? { phone } : {}),
            ...(position ? { position } : {}),
            ...(departmentId ? { departmentId } : {}),
            roles,
          },
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
      title={employee ? `Ubah ${employee.name}` : 'Tambah karyawan'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" form="employee-form" className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id="employee-form" onSubmit={submit} className="stack">
        {error ? <div className="alert error">{error}</div> : null}
        {!employee ? (
          <Field label="NIP / nomor karyawan">
            <TextInput
              value={employeeNo}
              onChange={(event) => setEmployeeNo(event.target.value)}
              required
              placeholder="Contoh: 10234"
            />
          </Field>
        ) : null}
        <Field label="Nama lengkap">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field
          label="Email"
          hint={
            employee && !canCreate
              ? 'Perubahan email login hanya dapat dilakukan admin.'
              : undefined
          }
        >
          <TextInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!!employee && !canCreate}
            required
          />
        </Field>
        {!employee ? (
          <Field label="Kata sandi awal" hint="Minimal 8 karakter, kombinasi huruf dan angka.">
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </Field>
        ) : null}
        <Field label="Telepon">
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Jabatan">
          <TextInput value={position} onChange={(event) => setPosition(event.target.value)} />
        </Field>
        <Field label="Unit">
          <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">Tanpa unit</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>
        {!employee && canCreate ? (
          <Field label="Peran akun">
            <div className="row">
              {ROLES.map((role) => (
                <label key={role} className="checkline">
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={(event) => {
                      setRoles((current) =>
                        event.target.checked
                          ? [...current, role]
                          : current.filter((item) => item !== role),
                      );
                    }}
                  />
                  {role}
                </label>
              ))}
            </div>
          </Field>
        ) : null}
      </form>
    </Modal>
  );
}
