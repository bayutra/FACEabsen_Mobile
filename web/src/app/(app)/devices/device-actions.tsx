'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// STEP 18 — admin device actions (revoke with reason, mark lost).
export function DeviceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'revoke' | 'mark-lost') {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!res.ok) throw new Error(`Gagal (${res.status})`);
      router.refresh();
    } catch {
      setError('Aksi gagal. Coba lagi.');
      setBusy(null);
    }
  }

  if (status === 'REVOKED') {
    return <p className="text-sm text-outline">Perangkat ini sudah dicabut.</p>;
  }

  return (
    <div className="space-y-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Alasan (opsional)"
        aria-label="Alasan (opsional)"
        className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act('revoke')}>
          {busy === 'revoke' ? '…' : 'Cabut'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act('mark-lost')}>
          {busy === 'mark-lost' ? '…' : 'Tandai hilang'}
        </Button>
      </div>
    </div>
  );
}
