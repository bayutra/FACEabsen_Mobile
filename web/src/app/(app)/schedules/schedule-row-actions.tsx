'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  id: string;
  employeeName: string;
  workDate: string;
}

/**
 * Unassign a roster row (admin `schedule:manage`).
 *
 * Delete is refused while an attendance already points at the row — history
 * protection. That reason is shown verbatim so the admin knows to resolve the
 * attendance (or use Koreksi Presensi) instead of retrying.
 */
export function ScheduleRowActions({ id, employeeName, workDate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function remove() {
    if (!window.confirm(`Hapus jadwal ${employeeName} pada ${workDate}?`)) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus jadwal.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="destructive" disabled={busy} onClick={remove}>
        {busy ? '…' : 'Hapus'}
      </Button>
      {error && <p role="alert" className="text-label-sm text-danger-fg">{error}</p>}
    </div>
  );
}