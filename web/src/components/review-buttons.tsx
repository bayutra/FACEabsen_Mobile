'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// STEP 17-18 — approve/reject buttons with optional note (corrections,
// leaves, device-change).
export function ReviewButtons({ kind, id }: { kind: 'corrections' | 'leaves' | 'device-change'; id: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'approve' | 'reject') {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${kind}/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note.trim() ? { reviewNote: note.trim() } : {}),
      });
      if (!res.ok) throw new Error(`Gagal (${res.status})`);
      router.refresh();
    } catch {
      setError('Aksi gagal. Coba lagi.');
      setBusy(null);
    }
  }

  return (
    <div className="space-y-space-sm">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
        aria-label="Catatan (opsional)"
        rows={2}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface transition-colors placeholder:text-outline hover:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy !== null} onClick={() => act('approve')}>
          {busy === 'approve' ? '…' : 'Setujui'}
        </Button>
        {/* Reject is destructive: red fill, per DESIGN.md destructive button. */}
        <Button
          size="sm"
          variant="destructive"
          disabled={busy !== null}
          onClick={() => act('reject')}
        >
          {busy === 'reject' ? '…' : 'Tolak'}
        </Button>
      </div>
    </div>
  );
}
