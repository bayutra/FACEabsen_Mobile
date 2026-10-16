'use client';

import { useEffect, useState } from 'react';

// Live backend connectivity probe for the dashboard shell.
export function BackendStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    let alive = true;
    fetch('/api/health', { cache: 'no-store' })
      .then((res) => {
        if (alive) setStatus(res.ok ? 'ok' : 'down');
      })
      .catch(() => {
        if (alive) setStatus('down');
      });
    return () => {
      alive = false;
    };
  }, []);

  const TONE = {
    ok: 'border-success-border bg-success-bg text-success-fg',
    down: 'border-danger-border bg-danger-bg text-danger-fg',
    checking: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant',
  } as const;

  const LABEL = {
    ok: 'Backend terhubung',
    down: 'Backend tidak terjangkau',
    checking: 'Memeriksa backend…',
  } as const;

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-label-md ${TONE[status]}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status === 'ok' ? 'bg-success' : status === 'down' ? 'bg-danger' : 'bg-ink-disabled'
        }`}
        aria-hidden
      />
      {LABEL[status]}
    </span>
  );
}
