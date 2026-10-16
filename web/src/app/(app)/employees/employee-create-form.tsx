'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/surface';

/** DESIGN.md: `label-md` above every control. */
const labelClass = 'block text-label-md text-on-surface';

interface Option {
  id: string;
  label: string;
}

interface Props {
  departments: Option[];
  supervisors: Option[];
}

// Assignable roles. Backend force-adds EMPLOYEE and blocks SUPER_ADMIN for
// non-SUPER_ADMIN actors, so that option is deliberately absent here.
const ASSIGNABLE_ROLES = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'ADMIN', label: 'Admin' },
] as const;

// STEP 5 — employee provisioning (admin `employee:create`). There is no
// self-registration: HR/ADMIN creates the account, the employee changes the
// temporary password on first login.
export function EmployeeCreateForm({ departments, supervisors }: Props) {
  const router = useRouter();
  const uid = useId().replace(/:/g, '');
  const idp = `emp-${uid}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const inFlight = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Kembalikan fokus ke tombol pemicu saat form ditutup (batal/berhasil).
  useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const [form, setForm] = useState({
    employeeNo: '',
    name: '',
    email: '',
    phone: '',
    position: '',
    departmentId: '',
    supervisorId: '',
    password: '',
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function toggleRole(value: string) {
    setRoles((r) => (r.includes(value) ? r.filter((x) => x !== value) : [...r, value]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, roles }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      setForm({
        employeeNo: '', name: '', email: '', phone: '',
        position: '', departmentId: '', supervisorId: '', password: '',
      });
      setRoles([]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan. Coba lagi.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button ref={triggerRef} onClick={() => setOpen(true)}>
        Tambah karyawan
      </Button>
    );
  }

  return (
    <section className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1 lg:max-w-2xl">
      <h2 className="mb-space-md text-headline-md text-on-surface">Tambah Karyawan</h2>
      <form onSubmit={submit} className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${idp}-no`}>NIP</label>
          <input id={`${idp}-no`} required autoFocus value={form.employeeNo} onChange={set('employeeNo')}
            placeholder="EMP-005" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-name`}>Nama lengkap</label>
          <input id={`${idp}-name`} required value={form.name} onChange={set('name')}
            placeholder="Budi Santoso" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-email`}>Email</label>
          <input id={`${idp}-email`} type="email" required value={form.email} onChange={set('email')}
            placeholder="budi@rs.test" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-phone`}>Telepon (opsional)</label>
          <input id={`${idp}-phone`} value={form.phone} onChange={set('phone')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-pos`}>Jabatan (opsional)</label>
          <input id={`${idp}-pos`} value={form.position} onChange={set('position')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-dept`}>Departemen</label>
          <select id={`${idp}-dept`} value={form.departmentId} onChange={set('departmentId')} className={inputClass}>
            <option value="">— belum —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-sup`}>Atasan langsung</label>
          <select id={`${idp}-sup`} value={form.supervisorId} onChange={set('supervisorId')} className={inputClass}>
            <option value="">— belum —</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-pass`}>Password sementara</label>
          <input id={`${idp}-pass`} type="password" required minLength={8} value={form.password}
            onChange={set('password')} placeholder="min. 8, huruf besar + kecil + angka" className={inputClass} />
          <p className="mt-1 text-xs text-outline">Wajib diganti karyawan saat login pertama.</p>
        </div>

        <div className="sm:col-span-2">
          <span className={labelClass}>Role tambahan</span>
          <div className="flex flex-wrap gap-3">
            {ASSIGNABLE_ROLES.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={roles.includes(r.value)}
                  onChange={() => toggleRole(r.value)}
                />
                {r.label}
              </label>
            ))}
            <span className="text-xs text-outline">Role Karyawan otomatis.</span>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="sm:col-span-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan karyawan'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </section>
  );
}