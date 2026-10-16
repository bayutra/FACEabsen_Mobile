import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// BFF for roster rows. GET = list (query passthrough), POST = assign
// (admin `schedule:manage`). One roster row per (employee, workDate); a night
// shift anchors on its start date, so the backend rejects a same-day duplicate.
export async function GET(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { search } = new URL(req.url);
  const res = await backend(`/schedules${search}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'schedules'), res.status);
}

const CREATE_FIELDS = ['employeeId', 'shiftId', 'workDate'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  for (const key of CREATE_FIELDS) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim() !== '') payload[key] = v.trim();
  }
  // Catch a malformed date here rather than letting it reach the DTO as a
  // confusing 400; the operator most likely meant YYYY-MM-DD.
  if (typeof payload.workDate === 'string' && !DATE.test(payload.workDate)) {
    return NextResponse.json({ message: 'Tanggal harus format YYYY-MM-DD' }, { status: 400 });
  }
  if (!payload.employeeId || !payload.shiftId || !payload.workDate) {
    return NextResponse.json(
      { message: 'Karyawan, shift, dan tanggal wajib diisi' },
      { status: 400 },
    );
  }

  const res = await backend('/schedules', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return passthroughJson(await upstreamJson(res, 'schedules'), res.status);
}