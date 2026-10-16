import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// STEP 18 — BFF for admin device actions (revoke, mark-lost).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id, action } = await params;
  if (action !== 'revoke' && action !== 'mark-lost') {
    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const res = await backend(`/devices/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return passthroughJson(await upstreamJson(res, 'devices/[id]/[action]'), res.status);
}
