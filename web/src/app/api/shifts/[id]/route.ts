import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

const NUMERIC_FIELDS = new Set(['gracePeriodMin', 'lateThresholdMin', 'earlyCheckoutThresholdMin']);
const STRING_FIELDS = new Set(['name', 'startTime', 'endTime']);

// Shift detail: GET = read one, PATCH = retune, DELETE = remove.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const res = await backend(`/shifts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'shifts/[id]'), res.status);
}

// Shift detail mutations (admin `shift:manage`): retune or remove.
// `overnight` stays derived server-side from the start/end window.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (NUMERIC_FIELDS.has(key)) {
      const n = Number(value);
      if (value !== '' && value !== null && value !== undefined && Number.isFinite(n)) payload[key] = n;
    } else if (STRING_FIELDS.has(key) && typeof value === 'string' && value.trim() !== '') {
      payload[key] = value.trim();
    }
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ message: 'Tidak ada field yang diubah' }, { status: 400 });
  }

  const res = await backend(`/shifts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return passthroughJson(await upstreamJson(res, 'shifts/[id]'), res.status);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const res = await backend(`/shifts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'shifts/[id]'), res.status);
}