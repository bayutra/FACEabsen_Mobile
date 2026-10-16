'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/surface';

/** DESIGN.md: `label-md` above every control. */
const labelClass = 'block text-label-md text-on-surface';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Karyawan', hint: 'Absen & ajukan sendiri' },
  { value: 'SUPERVISOR', label: 'Supervisor', hint: 'Setujui timnya' },
  { value: 'ADMIN', label: 'Admin', hint: 'Kelola karyawan & master data' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', hint: 'Sistem, role, keamanan' },
] as const;

/**
 * Creates a login account (`user:manage`).
 *
 * Deliberately not the same thing as "Tambah Karyawan": that flow also writes
 * the employee record, NIP, and department needed for attendance. This one is
 * for desk accounts (IT, admin) that sign in but never clock in.
 *
 * The backend refuses roles the actor may not grant, so the SUPER_ADMIN option
 * is hidden for anyone who is not a SUPER_ADMIN — the choice could never
 * succeed for them. The server-side guard still applies regardless; hiding an
 * option is UX, not the enforcement.
 */
export function UserCreateForm({ canGrantSuperAdmin }: { canGrantSuperAdmin: boolean }) {
  const router = useRouter();
  const uid = useId().replace(/:/g, '');
  const idp = `user-${uid}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>(['EMPLOYEE']);
  const [form, setForm] = useState({ email: '', password: '' });
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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, roles }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      setForm({ email: '', password: '' });
      setRoles(['EMPLOYEE']);
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
    return <Button ref={triggerRef} onClick={() => setOpen(true)}>Tambah akun</Button>;
  }

  return (
    <section className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1 lg:max-w-2xl">
      <h2 className="mb-space-md text-headline-md text-on-surface">Tambah Akun</h2>
      <form onSubmit={submit} className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${idp}-email`}>Email</label>
          <input
            id={`${idp}-email`}
            type="email"
            required
            autoFocus
            value={form.email}
            onChange={set('email')}
            placeholder="nama@rs.test"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-pass`}>Password sementara</label>
          <input
            id={`${idp}-pass`}
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            placeholder="min. 8, huruf besar + kecil + angka"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <span className={labelClass}>Role</span>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.filter((r) => r.value !== 'SUPER_ADMIN' || canGrantSuperAdmin).map((r) => (
              <label
                key={r.value}
                className="flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={roles.includes(r.value)}
                  onChange={() => toggleRole(r.value)}
                />
                <span>
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-outline">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-outline">
            Role Karyawan selalu ditambahkan otomatis oleh sistem.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg sm:col-span-2"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy || roles.length === 0}>
            {busy ? 'Menyimpan…' : 'Simpan akun'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </section>
  );
}