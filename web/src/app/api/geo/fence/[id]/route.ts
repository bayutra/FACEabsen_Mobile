import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// BFF tulis perimeter (SUPER_ADMIN + security:manage). Validasi rentang
// ditegakkan backend via UpdateFenceDto; perubahan diaudit GEOFENCE_UPDATED.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Body JSON tidak valid' }, { status: 400 });
  }
  const res = await backend(`/geo/fence/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return passthroughJson(await upstreamJson(res, 'geo/fence/[id]'), res.status);
}
