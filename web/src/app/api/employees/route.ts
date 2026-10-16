import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// STEP 5 — BFF for the employees section. GET = list, POST = create
// (admin `employee:create`). Browser never talks to the backend directly.
export async function GET(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { search } = new URL(req.url);
  const res = await backend(`/employees${search}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'employees'), res.status);
}

const CREATE_FIELDS = [
  'employeeNo', 'name', 'email', 'phone', 'position',
  'departmentId', 'supervisorId', 'password', 'roles',
] as const;

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

  // Whitelist mirrors the backend DTO; the API rejects unknown fields anyway.
  const payload: Record<string, unknown> = {};
  for (const key of CREATE_FIELDS) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim() !== '') payload[key] = v.trim();
    else if (Array.isArray(v) && v.length > 0) payload[key] = v;
  }
  if (Array.isArray(raw.roles)) {
    const roles = (raw.roles as unknown[]).filter((r): r is string => typeof r === 'string');
    if (roles.length > 0) payload.roles = roles;
  }

  const res = await backend('/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return passthroughJson(await upstreamJson(res, 'employees'), res.status);
}
