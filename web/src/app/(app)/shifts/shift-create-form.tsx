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

const NUMERIC_FIELDS = [
  { key: 'gracePeriodMin', label: 'Toleransi (mnt)' },
  { key: 'lateThresholdMin', label: 'Ambang telat (mnt)' },
  { key: 'earlyCheckoutThresholdMin', label: 'Ambang pulang cepat (mnt)' },
] as const;

/**
 * Master data — shift provisioning (admin `shift:manage`).
 * `overnight` is not sent: the backend derives it from the window and rejects
 * a contradicting value, so the operator only picks start/end.
 */
export function ShiftCreateForm({ hospitals }: Props) {
  const router = useRouter();
  const uid = useId().replace(/:/g, '');
  const idp = `shift-${uid}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    hospitalId: hospitals[0]?.id ?? '',
    name: '',
    startTime: '07:00',
    endTime: '15:00',
    gracePeriodMin: '15',
    lateThresholdMin: '30',
    earlyCheckoutThresholdMin: '15',
  });
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
      const res = await fetch('/api/shifts', {
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
        Tambah shift
      </Button>
    );
  }

  return (
    <section className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1 lg:max-w-2xl">
      <h2 className="mb-space-md text-headline-md text-on-surface">Tambah Shift</h2>
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
          <label className={labelClass} htmlFor={`${idp}-name`}>Nama shift</label>
          <input
            id={`${idp}-name`}
            required
            minLength={2}
            maxLength={32}
            value={form.name}
            onChange={set('name')}
            placeholder="PAGI"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-start`}>Mulai</label>
          <input
            id={`${idp}-start`}
            type="time"
            required
            value={form.startTime}
            onChange={set('startTime')}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-end`}>Selesai</label>
          <input
            id={`${idp}-end`}
            type="time"
            required
            value={form.endTime}
            onChange={set('endTime')}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-outline">
            Selesai lebih awal dari mulai berarti shift malam (+1 hari).
          </p>
        </div>

        {NUMERIC_FIELDS.map((f) => (
          <div key={f.key}>
            <label className={labelClass} htmlFor={`${idp}-${f.key}`}>{f.label}</label>
            <input
              id={`${idp}-${f.key}`}
              type="number"
              min={0}
              step={1}
              value={form[f.key]}
              onChange={set(f.key)}
              className={inputClass}
            />
          </div>
        ))}

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
            {busy ? 'Menyimpan…' : 'Simpan shift'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </section>
  );
}