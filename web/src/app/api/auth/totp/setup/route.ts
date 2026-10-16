import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend, passthroughJson, upstreamJson } from '@/lib/api';

// Mulai pendaftaran: secret baru berstatus menunggu (belum aktif).
// Memanggil ulang membatalkan pendaftaran sebelumnya yang belum dikonfirmasi.
export async function POST() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const res = await backend('/auth/totp/setup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return passthroughJson(await upstreamJson(res, 'auth/totp/setup'), res.status);
}
