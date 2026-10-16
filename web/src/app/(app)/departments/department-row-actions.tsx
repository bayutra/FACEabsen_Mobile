'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/surface';

const labelClass = 'block text-label-md text-on-surface';

interface Props {
  id: string;
  name: string;
}

/**
 * Per-row department mutations (admin `department:manage`).
 *
 * Delete is not guaranteed to succeed: a department that still has employees
 * assigned is refused by the backend (Restrict FK), and that reason is surfaced
 * verbatim so the admin knows to move the staff first.
 */
export function DepartmentRowActions({ id, name }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(name);
  const [prevName, setPrevName] = useState(name);
  const inFlight = useRef(false);

  // Selaraskan draf saat prop berubah (mis. setelah router.refresh()):
  // penyesuaian saat render (pola resmi React), bukan effect — hanya
  // perubahan prop yang memicu, jadi ketikan yang belum disimpan tidak hilang.
  if (prevName !== name) {
    setPrevName(name);
    setDraft(name);
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah nama.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Hapus departemen "${name}"?`)) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <form onSubmit={rename} className="flex items-end gap-2">
          <div>
            <label className={labelClass} htmlFor={`dept-rename-${id}`}>Nama baru</label>
            <input
              id={`dept-rename-${id}`}
              required
              minLength={2}
              maxLength={64}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={`${inputClass} w-48`}
            />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? '…' : 'Simpan'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setDraft(name);
              setEditing(false);
              setError(null);
            }}
          >
            Batal
          </Button>
        </form>
        {error && <p role="alert" className="text-label-sm text-danger-fg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Ubah
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={remove}>
          {busy ? '…' : 'Hapus'}
        </Button>
      </div>
      {error && <p role="alert" className="text-label-sm text-danger-fg">{error}</p>}
    </div>
  );
}