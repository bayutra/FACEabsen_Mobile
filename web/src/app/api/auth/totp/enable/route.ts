import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// Konfirmasi pendaftaran: kode harus cocok dengan secret yang menunggu.
// Sukses mengembalikan 8 kode pemulihan yang hanya ditampilkan sekali.
export async function POST(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const parsed = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = parsed?.code;
  if (typeof code !== 'string') {
    return NextResponse.json({ message: 'Kode wajib diisi' }, { status: 400 });
  }

  const res = await backend('/auth/totp/enable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return passthroughJson(await upstreamJson(res, 'auth/totp/enable'), res.status);
}
