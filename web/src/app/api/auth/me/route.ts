import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  backend,
  cookieFlags,
  passthroughJson,
  tryServerRefresh,
  upstreamJson,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
} from '@/lib/api';

export async function GET() {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (token) {
    const res = await backend('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return passthroughJson(await upstreamJson(res, 'auth/me'), res.status);
    // Access expired — try one refresh before giving up (instead of just
    // deleting the access cookie and forcing a re-login).
    if (res.status !== 401) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
    }
  }

  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }
  const rotated = await tryServerRefresh(refresh);
  if (!rotated) {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }
  store.set(ACCESS_COOKIE, rotated.accessToken, cookieFlags(ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, rotated.refreshToken, cookieFlags(REFRESH_MAX_AGE));

  const retry = await backend('/auth/me', {
    headers: { Authorization: `Bearer ${rotated.accessToken}` },
  });
  if (!retry.ok) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }
  return passthroughJson(await retry.json().catch(() => null), retry.status);
}
