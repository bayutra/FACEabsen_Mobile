import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  backend,
  cookieFlags,
  upstreamJson,
} from '@/lib/api';
import { canUseWeb, rolesOf } from '@/lib/nav';

// Publik: penyelesaian tantangan login langkah kedua (tanpa sesi).
// Teruskan status + pesan backend apa adanya; saat sukses setel cookie
// httpOnly yang sama persis seperti login.
export async function POST(req: Request) {
  const parsed = (await req.json().catch(() => null)) as {
    totpToken?: unknown;
    code?: unknown;
  } | null;
  const totpToken = parsed?.totpToken;
  const code = parsed?.code;
  if (typeof totpToken !== 'string' || typeof code !== 'string') {
    return NextResponse.json({ message: 'Token dan kode wajib diisi' }, { status: 400 });
  }

  const res = await backend('/auth/totp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totpToken, code }),
  });

  if (!res.ok) {
    const body = (await upstreamJson(res, 'auth/totp/verify')) as {
      message?: unknown;
    } | null;
    const message =
      typeof body?.message === 'string' && body.message.length > 0
        ? body.message
        : 'Verifikasi gagal. Coba lagi nanti.';
    return NextResponse.json({ message }, { status: res.status });
  }

  const body = (await upstreamJson(res, 'auth/totp/verify')) as {
    accessToken?: unknown;
    refreshToken?: unknown;
    user?: unknown;
  } | null;
  if (
    !body ||
    typeof body.accessToken !== 'string' ||
    body.accessToken.length === 0 ||
    typeof body.refreshToken !== 'string' ||
    body.refreshToken.length === 0
  ) {
    return NextResponse.json({ message: 'Respons login tidak valid' }, { status: 502 });
  }
  // Akun karyawan murni (EMPLOYEE) khusus aplikasi mobile — jangan buat sesi web.
  if (!canUseWeb(rolesOf(body.user))) {
    return NextResponse.json(
      { message: 'Akun karyawan hanya untuk aplikasi mobile. Minta akses dashboard ke admin.' },
      { status: 403 },
    );
  }
  const store = await cookies();
  store.set(ACCESS_COOKIE, body.accessToken, cookieFlags(ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, body.refreshToken, cookieFlags(REFRESH_MAX_AGE));
  return NextResponse.json({ user: body.user });
}
