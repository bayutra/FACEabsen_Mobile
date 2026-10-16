import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// Role and activation changes on a login account (`user:manage`).
// The backend enforces the rank guard, so a refusal arrives as 403/400 with a
// reason that is shown verbatim.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (typeof raw.isActive === 'boolean') payload.isActive = raw.isActive;
  if (Array.isArray(raw.roles)) {
    const roles = (raw.roles as unknown[]).filter((r): r is string => typeof r === 'string');
    if (roles.length === 0) {
      return NextResponse.json({ message: 'Minimal satu role wajib dipilih' }, { status: 400 });
    }
    payload.roles = roles;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ message: 'Tidak ada field yang diubah' }, { status: 400 });
  }

  const res = await backend(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return passthroughJson(await upstreamJson(res, 'users/[id]'), res.status);
}