import Link from 'next/link';

// UI 403 untuk segmen (app): dirender saat halaman memanggil `forbidden()`
// dari `next/navigation` (docs: app/api-reference/file-conventions/forbidden).
// Membutuhkan `experimental.authInterrupts: true` di next.config.ts.
export default function Forbidden() {
  return (
    <div className="space-y-gutter">
      <div
        role="alert"
        className="rounded-xl border border-warning-border bg-warning-bg px-4 py-5 text-body-md text-warning-fg"
      >
        <h1 className="text-headline-md text-on-surface">Akses ditolak</h1>
        <p className="mt-1 text-body-sm">
          Akun Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin jika Anda
          merasa seharusnya memiliki akses.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-block rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md-medium text-on-surface transition-colors hover:bg-surface-container-low"
      >
        ← Kembali ke dasbor
      </Link>
    </div>
  );
}
