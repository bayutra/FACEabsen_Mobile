'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Modal, TextArea } from '@/components/ui';

export function ReviewModal({
  open,
  title,
  description,
  approveLabel = 'Setujui',
  rejectLabel = 'Tolak',
  onClose,
  onDecide,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  approveLabel?: string;
  rejectLabel?: string;
  onClose: () => void;
  onDecide: (decision: 'APPROVE' | 'REJECT', note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
      setBusy(null);
    }
  }, [open]);

  const run = async (decision: 'APPROVE' | 'REJECT') => {
    setBusy(decision);
    setError(null);
    try {
      await onDecide(decision, note.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={!!busy}>
            Batal
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => run('REJECT')}
            disabled={!!busy}
          >
            {busy === 'REJECT' ? 'Memproses…' : rejectLabel}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => run('APPROVE')}
            disabled={!!busy}
          >
            {busy === 'APPROVE' ? 'Memproses…' : approveLabel}
          </button>
        </>
      }
    >
      {description}
      <label className="field">
        <span>Catatan peninjau (opsional)</span>
        <TextArea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Alasan atau catatan untuk karyawan"
        />
      </label>
      {error ? <div className="alert error">{error}</div> : null}
    </Modal>
  );
}
