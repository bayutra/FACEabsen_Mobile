'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/surface';
import type { HospitalOption } from '@/lib/master-data';

/** DESIGN.md: `label-md` above every control. */
const labelClass = 'block text-label-md text-on-surface';

interface Props {
  hospitals: HospitalOption[];
}

/** Master data — department provisioning (admin `department:manage`). */
export function DepartmentCreateForm({ hospitals }: Props) {
  const router = useRouter();
  const uid = useId().replace(/:/g, '');
  const idp = `dept-${uid}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ hospitalId: hospitals[0]?.id ?? '', name: '' });
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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      setForm((f) => ({ ...f, name: '' }));
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
        Tambah departemen
      </Button>
    );
  }

  return (
    <section className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1 lg:max-w-xl">
      <h2 className="mb-space-md text-headline-md text-on-surface">Tambah Departemen</h2>
      <form onSubmit={submit} className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${idp}-hospital`}>Fasilitas</label>
          <select
            id={`${idp}-hospital`}
            required
            autoFocus
            value={form.hospitalId}
            onChange={set('hospitalId')}
            className={inputClass}
          >
            {hospitals.length === 0 && <option value="">— belum ada fasilitas —</option>}
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-name`}>Nama departemen</label>
          <input
            id={`${idp}-name`}
            required
            minLength={2}
            maxLength={64}
            value={form.name}
            onChange={set('name')}
            placeholder="Radiologi"
            className={inputClass}
          />
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
          <Button type="submit" disabled={busy || hospitals.length === 0}>
            {busy ? 'Menyimpan…' : 'Simpan departemen'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </section>
  );
}