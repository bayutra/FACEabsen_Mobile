import { cookies } from 'next/headers';
import type { SessionUser } from '@/lib/api';

/**
 * Server-side session helpers for the dashboard.
 *
 * Access and refresh tokens never reach browser JavaScript: they are stored in
 * httpOnly cookies and only the Next.js server (route handlers) can read them.
 */

const API_ORIGIN = (process.env.API_ORIGIN ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const API_BASE = `${API_ORIGIN}/api/v1`;

export const ACCESS_COOKIE = 'fa_dashboard_access';
export const REFRESH_COOKIE = 'fa_dashboard_refresh';

const DEFAULT_ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

export type BackendSessionResponse = TokenPair & {
  user?: SessionUser;
  totpRequired?: boolean;
  totpToken?: string;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function setSessionCookies(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  const accessMaxAge =
    typeof tokens.expiresIn === 'number' && tokens.expiresIn > 0
      ? tokens.expiresIn
      : DEFAULT_ACCESS_MAX_AGE;
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(accessMaxAge));
  store.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  const clear = (path: string) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path,
    maxAge: 0,
  });
  // Clear current cookies (path=/) and legacy path-scoped cookies (/api).
  for (const path of ['/', '/api']) {
    store.set(ACCESS_COOKIE, '', clear(path));
    store.set(REFRESH_COOKIE, '', clear(path));
  }
}

export async function readAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
  accessToken?: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

let refreshInFlight: Promise<TokenPair | null> | null = null;

/**
 * Rotate the session once per server process even when several dashboard
 * requests hit a 401 at the same time. Concurrent rotations would trip the
 * backend's refresh-conflict detection and revoke the token family.
 */
export function refreshSession(): Promise<TokenPair | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await readRefreshToken();
    if (!refreshToken) return null;

    const res = await backendFetch('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearSessionCookies();
      return null;
    }

    const body = (await res.json().catch(() => null)) as Partial<TokenPair> | null;
    if (!body?.accessToken || !body.refreshToken) {
      await clearSessionCookies();
      return null;
    }

    const tokens: TokenPair = {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresIn: body.expiresIn,
    };
    await setSessionCookies(tokens);
    return tokens;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  // `req.url` tidak selalu memakai host publik: di belakang ngrok/reverse
  // proxy, atau saat dashboard dibuka lewat alias host (127.0.0.1 vs
  // localhost vs IP LAN), host di `req.url` bisa berbeda dari Origin.
  // Membandingkan Origin dengan header Host adalah bentuk standar
  // pemeriksaan same-origin — Host diisi browser dan tidak bisa ditentukan
  // penyerang CSRF. X-Forwarded-Host dipakai bila proxy meneruskannya.
  const headerHosts = [req.headers.get('x-forwarded-host'), req.headers.get('host')]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(',').map((part) => part.trim()));

  let urlHost: string | null = null;
  try {
    urlHost = new URL(req.url).host;
  } catch {
    urlHost = null;
  }

  const candidates = urlHost ? [urlHost, ...headerHosts] : headerHosts;
  if (candidates.includes(originHost)) return true;

  // Bantuan diagnosis: tampilkan kedua host saat penolakan.
  console.warn(
    `[same-origin] ditolak: origin=${originHost} url=${req.url} host=${headerHosts.join('|') || '-'}`,
  );
  return false;
}

export function jsonError(
  status: number,
  message: string,
  reason?: string,
): Response {
  return Response.json(reason ? { message, reason } : { message }, { status });
}
