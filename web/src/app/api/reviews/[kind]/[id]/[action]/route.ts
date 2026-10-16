import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// STEP 17-18 — BFF for correction/leave/device-change review actions.
// POST /api/reviews/:kind/:id/:action with optional { reviewNote }.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string; id: string; action: string }> },
) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { kind, id, action } = await params;
  const targets: Record<string, string> = {
    corrections: 'corrections',
    leaves: 'leaves',
    'device-change': 'device-change',
  };
  const target = targets[kind];
  if (!target || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ message: 'Unknown target' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const res = await backend(`/${target}/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return passthroughJson(await upstreamJson(res, 'reviews/[action]'), res.status);
}
