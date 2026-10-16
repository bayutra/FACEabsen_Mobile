import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// STEP 6 — BFF for shifts. GET = list, POST = create (admin `shift:manage`).
export async function GET(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { search } = new URL(req.url);
  const res = await backend(`/shifts${search}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'shifts'), res.status);
}

const CREATE_FIELDS = [
  'hospitalId', 'name', 'startTime', 'endTime',
  'gracePeriodMin', 'lateThresholdMin', 'earlyCheckoutThresholdMin',
] as const;

const NUMERIC_FIELDS: ReadonlySet<string> = new Set([
  'gracePeriodMin',
  'lateThresholdMin',
  'earlyCheckoutThresholdMin',
]);

export async function POST(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  // `overnight` is intentionally NOT forwarded: the backend derives it from
  // the start/end window and rejects a contradicting value.
  const payload: Record<string, unknown> = {};
  for (const key of CREATE_FIELDS) {
    const v = raw[key];
    if (NUMERIC_FIELDS.has(key)) {
      const n = Number(v);
      if (v !== '' && v !== null && v !== undefined && Number.isFinite(n)) payload[key] = n;
    } else if (typeof v === 'string' && v.trim() !== '') {
      payload[key] = v.trim();
    }
  }

  const res = await backend('/shifts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return passthroughJson(await upstreamJson(res, 'shifts'), res.status);
}