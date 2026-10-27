'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Modal, TextArea } from '@/components/ui';

export function ActionModal({
  open,
  title,
  description,
  fieldLabel,
  placeholder,
  confirmLabel = 'Simpan',
  danger = false,
  requireValue = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  fieldLabel?: string;
  placeholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireValue?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (requireValue && !value.trim()) {
      setError('Kolom ini wajib diisi.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className={danger ? 'btn danger' : 'btn'}
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Memproses…' : confirmLabel}
          </button>
        </>
      }
    >
      {description}
      {fieldLabel ? (
        <label className="field">
          <span>{fieldLabel}</span>
          <TextArea
            rows={3}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      ) : null}
      {error ? <div className="alert error">{error}</div> : null}
    </Modal>
  );
}
