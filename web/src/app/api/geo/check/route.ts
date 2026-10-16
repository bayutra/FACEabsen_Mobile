import { NextResponse } from 'next/server';

const BACKEND = process.env.DEV_BACKEND ?? 'http://localhost:3000/api/v1';

/**
 * Browser-facing geofence probe. Proxies to the backend's `POST /geo/check`
 * using the signed-in session cookie, so the browser never handles a token.
 */
export async function POST(req: Request) {
  const token = accessToken(req.headers.get('cookie') ?? '');
  if (!token) {
    return NextResponse.json({ message: 'Sesi berakhir' }, { status: 401 });
  }

  const upstream = await fetch(`${BACKEND}/geo/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: await req.text(),
    cache: 'no-store',
  });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Pulls the access token out of the session cookie string. */
function accessToken(cookie: string): string {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'access_token') return decodeURIComponent(rest.join('='));
  }
  return '';
}

export const dynamic = 'force-dynamic';
