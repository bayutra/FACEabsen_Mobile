import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// STEP 17 — read-only BFF passthrough for supervisor endpoints.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { path } = await params;
  const { search } = new URL(req.url);
  const target = `/supervisor/${path.map(encodeURIComponent).join('/')}${search}`;
  const res = await backend(target, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'team/[...path]'), res.status);
}
