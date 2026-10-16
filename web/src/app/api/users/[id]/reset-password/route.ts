import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// Administrative password reset (`user:manage`). Clears any lockout and kills
// the account's live sessions server-side; the password itself is never echoed.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  const password = typeof raw.password === 'string' ? raw.password : '';
  if (password.length < 8) {
    return NextResponse.json({ message: 'Password minimal 8 karakter' }, { status: 400 });
  }

  const res = await backend(`/users/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return passthroughJson(await upstreamJson(res, 'users/[id]/reset-password'), res.status);
}