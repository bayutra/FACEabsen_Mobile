'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/surface';
import { formatWindow } from '@/lib/shifts';

const labelClass = 'block text-label-md text-on-surface';

export interface EmployeeOption {
  id: string;
  employeeNo: string;
  name: string;
}

export interface ShiftOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
}

interface Props {
  employees: EmployeeOption[];
  shifts: ShiftOption[];
}

/**
 * Roster assignment (admin `schedule:manage`).
 *
 * One row per employee per date, so a same-day duplicate is rejected by the
 * backend ("Employee already scheduled on this date") and surfaced as-is.
 * A night shift counts as a single day anchored on its start date.
 */
export function ScheduleCreateForm({ employees, shifts }: Props) {
  const router = useRouter();
  const uid = useId().replace(/:/g, '');
  const idp = `sch-${uid}`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? '',
    shiftId: shifts[0]?.id ?? '',
    workDate: '',
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
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      setForm((f) => ({ ...f, workDate: '' }));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan. Coba lagi.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const disabled = busy || employees.length === 0 || shifts.length === 0;

  if (!open) {
    return (
      <Button ref={triggerRef} onClick={() => setOpen(true)} disabled={disabled}>
        Assign shift
      </Button>
    );
  }

  return (
    <section className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1 lg:max-w-2xl">
      <h2 className="mb-space-md text-headline-md text-on-surface">Assign Shift</h2>
      <form onSubmit={submit} className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${idp}-employee`}>Karyawan</label>
          <select
            id={`${idp}-employee`}
            required
            autoFocus
            value={form.employeeId}
            onChange={set('employeeId')}
            className={inputClass}
          >
            {employees.length === 0 && <option value="">— belum ada karyawan —</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeNo} · {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idp}-shift`}>Shift</label>
          <select
            id={`${idp}-shift`}
            required
            value={form.shiftId}
            onChange={set('shiftId')}
            className={inputClass}
          >
            {shifts.length === 0 && <option value="">— belum ada shift —</option>}
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatWindow(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${idp}-date`}>Tanggal kerja</label>
          <input
            id={`${idp}-date`}
            type="date"
            required
            value={form.workDate}
            onChange={set('workDate')}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-outline">
            Shift malam dihitung satu hari kerja, memakai tanggal mulai.
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
          <Button type="submit" disabled={disabled}>
            {busy ? 'Menyimpan…' : 'Simpan jadwal'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </form>
    </section>
  );
}