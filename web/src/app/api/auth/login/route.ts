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

export async function POST(req: Request) {
  const parsed = (await req.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;
  const email = parsed?.email;
  const password = parsed?.password;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ message: 'Email dan password wajib diisi' }, { status: 400 });
  }

  const res = await backend('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    // Jujur soal penolakan non-kredensial: akun terkunci (403 backend / 423)
    // dan rate-limit (429) meneruskan pesan backend apa adanya agar UI bisa
    // menjelaskan keadaan sebenarnya. Hanya 400/401 yang disamarkan sebagai
    // kredensial salah (anti-enumerasi).
    if (res.status === 403 || res.status === 423 || res.status === 429) {
      const body = (await upstreamJson(res, 'auth/login')) as {
        message?: unknown;
      } | null;
      const message =
        typeof body?.message === 'string' && body.message.length > 0
          ? body.message
          : 'Akses ditolak. Coba lagi nanti.';
      return NextResponse.json({ message }, { status: res.status });
    }
    if (res.status === 400 || res.status === 401) {
      return NextResponse.json({ message: 'Email atau password salah' }, { status: 401 });
    }
    const body = (await upstreamJson(res, 'auth/login')) as {
      message?: unknown;
    } | null;
    const message =
      typeof body?.message === 'string' && body.message.length > 0
        ? body.message
        : 'Login gagal. Coba lagi nanti.';
    return NextResponse.json({ message }, { status: res.status });
  }

  const body = (await upstreamJson(res, 'auth/login')) as {
    totpRequired?: unknown;
    totpToken?: unknown;
    expiresIn?: unknown;
    accessToken?: unknown;
    refreshToken?: unknown;
    user?: unknown;
  } | null;
  // TOTP kedua: password benar tetapi sesi belum dibuat — teruskan tantangan
  // ke klien tanpa menyetel cookie apa pun.
  if (
    body &&
    body.totpRequired === true &&
    typeof body.totpToken === 'string' &&
    body.totpToken.length > 0
  ) {
    return NextResponse.json({
      totpRequired: true,
      totpToken: body.totpToken,
      expiresIn: body.expiresIn,
    });
  }
  if (
    !body ||
    typeof body.accessToken !== 'string' ||
    body.accessToken.length === 0 ||
    typeof body.refreshToken !== 'string' ||
    body.refreshToken.length === 0
  ) {
    return NextResponse.json({ message: 'Respons login tidak valid' }, { status: 502 });
  }
  // Akun karyawan murni (EMPLOYEE) khusus aplikasi mobile — jangan buat sesi
  // web sama sekali. Tanpa cookie, proxy mengembalikan ke /login.
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
