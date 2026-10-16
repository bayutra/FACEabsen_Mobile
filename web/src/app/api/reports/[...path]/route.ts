import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend } from '@/lib/api';

// STEP 20 — BFF passthrough for reports. Forwards binary downloads
// (CSV/XLSX/PDF) untouched: status + content headers preserved.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { path } = await params;
  const { search } = new URL(req.url);
  // Binary exports (PDF/XLSX) render server-side and may legitimately take
  // longer than the default 15 s BFF budget.
  const res = await backend(
    `/reports/${path.map(encodeURIComponent).join('/')}${search}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    120_000,
  );

  const headers = new Headers();
  for (const h of ['content-type', 'content-disposition', 'content-length']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(await res.arrayBuffer(), { status: res.status, headers });
}
