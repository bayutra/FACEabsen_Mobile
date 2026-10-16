import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// Department detail mutations (admin `department:manage`): rename, remove.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return NextResponse.json({ message: 'Nama wajib diisi' }, { status: 400 });

  const res = await backend(`/departments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return passthroughJson(await upstreamJson(res, 'departments/[id]'), res.status);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { id } = await params;
  const res = await backend(`/departments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'departments/[id]'), res.status);
}