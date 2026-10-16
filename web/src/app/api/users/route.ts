import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// BFF for login accounts (`user:manage`). GET = list, POST = create.
// Staff who need to clock in are provisioned through /api/employees instead;
// this endpoint is for desk accounts (IT, admin) and role changes.
export async function GET(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { search } = new URL(req.url);
  const res = await backend(`/users${search}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'users'), res.status);
}

const CREATE_FIELDS = ['email', 'password', 'roles'] as const;

export async function POST(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  // Kebijakan kata sandi backend (min. 8) ditegakkan di sini juga agar tidak
  // hanya mengandalkan `minLength` di browser.
  const password = typeof raw.password === 'string' ? raw.password : '';
  if (password.length < 8) {
    return NextResponse.json({ message: 'Password minimal 8 karakter' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  for (const key of CREATE_FIELDS) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim() !== '') payload[key] = key === 'password' ? v : v.trim();
  }
  if (Array.isArray(raw.roles)) {
    // Keep only real strings; a junk entry would make the whole DTO reject.
    const roles = (raw.roles as unknown[]).filter((r): r is string => typeof r === 'string');
    if (roles.length > 0) payload.roles = roles;
  }

  const res = await backend('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return passthroughJson(await upstreamJson(res, 'users'), res.status);
}