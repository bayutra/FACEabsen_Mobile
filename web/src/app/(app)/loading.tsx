// Skeleton pemuatan untuk segmen (app): meniru susunan tabel + filter di
// halaman daftar (docs: app/api-reference/file-conventions/loading).
export default function AppLoading() {
  return (
    <div className="space-y-gutter" aria-busy="true" aria-label="Memuat data">
      <div className="border-b border-outline-variant/30 pb-4">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-container-low" />
        <div className="mt-2 h-7 w-64 animate-pulse rounded bg-surface-container-low" />
        <div className="mt-1 h-4 w-80 animate-pulse rounded bg-surface-container-low" />
      </div>

      <div className="flex flex-wrap items-end gap-space-sm rounded-lg border border-outline-variant bg-surface-container-low p-space-md">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-container-lowest" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-surface-container-lowest" />
        <div className="h-10 w-20 animate-pulse rounded-lg bg-surface-container-lowest" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-surface-1">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <th className="px-4 py-3 text-left">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-container-low" />
              </th>
              <th className="px-4 py-3 text-left">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-container-low" />
              </th>
              <th className="px-4 py-3 text-left">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-container-low" />
              </th>
              <th className="px-4 py-3 text-left">
                <div className="h-4 w-16 animate-pulse rounded bg-surface-container-low" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="h-[52px] border-b border-outline-variant/30 last:border-0">
                <td className="px-4 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-surface-container-low" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-48 animate-pulse rounded bg-surface-container-low" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-surface-container-low" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-6 w-16 animate-pulse rounded-md bg-surface-container-low" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
