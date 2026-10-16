import Link from 'next/link';

/**
 * Branded 404 for unknown (app) URLs. Replaces the old `[...slug]` catch-all,
 * which answered every typo with HTTP 200 and hid broken links.
 */
export default function AppNotFound() {
  return (
    <div className="space-y-gutter">
      <div
        role="alert"
        className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-10 text-center shadow-surface-1"
      >
        <p className="tabular text-headline-xl text-outline">404</p>
        <h1 className="mt-1 text-headline-md text-on-surface">Halaman tidak ditemukan</h1>
        <p className="mx-auto mt-1 max-w-md text-body-sm text-outline">
          Alamat yang Anda buka tidak terdaftar. Periksa kembali tautan atau kembali ke dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-primary-container"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
