import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// Lepas faktor kedua setelah otentikasi ulang memakai password saat ini.
export async function POST(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const parsed = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = parsed?.password;
  if (typeof password !== 'string') {
    return NextResponse.json({ message: 'Password wajib diisi' }, { status: 400 });
  }

  const res = await backend('/auth/totp/disable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return passthroughJson(await upstreamJson(res, 'auth/totp/disable'), res.status);
}
