import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  backend,
  cookieFlags,
} from '@/lib/api';

export async function POST() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const res = await backend('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const body = await res.json();
  store.set(ACCESS_COOKIE, body.accessToken, cookieFlags(ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, body.refreshToken, cookieFlags(REFRESH_MAX_AGE));
  return NextResponse.json({ ok: true });
}

/**
 * GET dipakai navigasi server-side (layout) saat access kedaluwarsa:
 * merotasi + MENYIMPAN cookie (yang tidak bisa dilakukan server component),
 * lalu kembali ke halaman asal via Referer same-origin.
 *
 * Tanpa ini, layout yang merotasi read-only akan menghanguskan refresh
 * (backend CAS atomik) tanpa menyimpan penggantinya → sesi mati berikutnya.
 */
export async function GET(req: Request) {
  const back = (() => {
    try {
      const ref = new URL(req.headers.get('referer') ?? '', req.url);
      if (ref.origin !== new URL(req.url).origin) return '/dashboard';
      if (!ref.pathname.startsWith('/') || ref.pathname.startsWith('/api/')) {
        return '/dashboard';
      }
      return `${ref.pathname}${ref.search}`;
    } catch {
      return '/dashboard';
    }
  })();

  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const res = await backend('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const body = await res.json();
  store.set(ACCESS_COOKIE, body.accessToken, cookieFlags(ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, body.refreshToken, cookieFlags(REFRESH_MAX_AGE));
  return NextResponse.redirect(new URL(back, req.url));
}
