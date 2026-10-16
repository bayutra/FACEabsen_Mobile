import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ReviewButtons } from '@/components/review-buttons';
import { Badge } from '@/components/ui/surface';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import type { ReviewQueueItem } from '@/lib/team';

// STEP 17 — team correction approvals (supervisor-scoped queue).
export default async function TeamCorrectionsPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${backendUrl()}/corrections?status=PENDING`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat koreksi tim');

  const items = (await res.json()) as ReviewQueueItem[];

  return (
    <div className="space-y-gutter">
      {items.map((c) => (
        <section
          key={c.id}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-headline-md text-on-surface">{c.employee?.name}</p>
              <p className="tabular text-label-sm text-outline">{c.employee?.employeeNo}</p>
            </div>
            <Badge tone="warning">{c.type}</Badge>
          </div>
          <p className="mt-2 text-body-md text-on-surface-variant">{c.reason}</p>
          <div className="mt-space-md border-t border-outline-variant/30 pt-space-md">
            <ReviewButtons kind="corrections" id={c.id} />
          </div>
        </section>
      ))}
      {items.length === 0 && (
        <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-10 text-center text-body-md text-outline">
          Tidak ada koreksi menunggu.
        </p>
      )}
    </div>
  );
}
