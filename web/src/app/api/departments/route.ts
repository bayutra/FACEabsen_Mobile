import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// STEP 14 — BFF for departments. GET = list, POST = create
// (admin `department:manage`). Browser never talks to the backend directly.
export async function GET(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { search } = new URL(req.url);
  const res = await backend(`/departments${search}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'departments'), res.status);
}

const CREATE_FIELDS = ['hospitalId', 'name'] as const;

export async function POST(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  // Whitelist mirrors the backend DTO; the API rejects unknown fields anyway.
  const payload: Record<string, unknown> = {};
  for (const key of CREATE_FIELDS) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim() !== '') payload[key] = v.trim();
  }

  const res = await backend('/departments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return passthroughJson(await upstreamJson(res, 'departments'), res.status);
}