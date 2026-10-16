'use client'; // Error boundary harus Client Component (docs: app/api-reference/file-conventions/error).

import { useEffect } from 'react';

// NOTE: Next 16.3 menamai prop pemulih `retry` (stabil di v16.3.0; `reset`
// hanya mengosongkan state tanpa refetch — lihat
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
// Kedua nama diterima agar kompatibel dengan pemanggil lama.
export default function AppError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const recover = retry ?? reset;

  return (
    <div className="space-y-gutter">
      <div
        role="alert"
        className="rounded-xl border border-danger-border bg-danger-bg px-4 py-5 text-body-md text-danger-fg"
      >
        <h1 className="text-headline-md text-on-surface">Gagal memuat halaman</h1>
        <p className="mt-1 text-body-sm">
          {error.message && error.message !== 'An unknown error occurred'
            ? error.message
            : 'Terjadi kesalahan saat memuat data. Coba lagi.'}
        </p>
        {error.digest && (
          <p className="tabular mt-1 text-label-sm text-outline">Kode: {error.digest}</p>
        )}
      </div>
      {recover && (
        <button
          type="button"
          onClick={() => recover()}
          className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488]"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}
