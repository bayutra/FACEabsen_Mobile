// STEP 4 — server-side backend access + cookie contract for BFF routes.
// Browser never talks to the backend directly: all calls go through
// same-origin /api/* handlers that attach httpOnly cookies (XSS-safe).

import { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_MAX_AGE = 15 * 60; // mirrors backend JWT_ACCESS_TTL_SEC
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export function backendUrl(): string {
  // API_URL is the only server-intended source. NEXT_PUBLIC_API_URL is a
  // client-bundled fallback kept for local dev only: in production a missing
  // API_URL fails fast instead of silently shipping the internal backend
  // address (or localhost) to browsers.
  const url =
    process.env.API_URL ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'));
  if (!url) {
    throw new Error('API_URL is not set (required in production)');
  }
  return url;
}

/** Hospital calendar zone. Must match backend HOSPITAL_TZ (default WIB). */
export const HOSPITAL_TZ = process.env.HOSPITAL_TZ ?? 'Asia/Jakarta';

/** Hospital-local calendar key (YYYY-MM-DD). Never use toISOString() for dates. */
export function hospitalToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOSPITAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Hospital-local month key (YYYY-MM). */
export function hospitalMonth(now = new Date()): string {
  return hospitalToday(now).slice(0, 7);
}

export function backend(path: string, init?: RequestInit, timeoutMs = 15_000): Promise<Response> {
  // Rush-hour guard: a slow backend must fail fast instead of hanging every
  // web navigation behind it (cascade). Callers with legitimately slow
  // responses (file exports) pass a larger budget explicitly. A caller-owned
  // signal always wins.
  return fetch(`${backendUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

/**
 * 204-safe JSON passthrough for BFF routes. `NextResponse.json(body, ...)`
 * throws on a 204 (a body is forbidden), so a backend 204 short-circuits to
 * an empty response with the status preserved. No backend route returns 204
 * today — this is defensive only.
 */
export function passthroughJson(body: unknown, status: number): NextResponse {
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(body, { status });
}

/**
 * Parses an upstream backend body, logging the raw text (truncated) when it
 * is not JSON — typically an nginx/gateway HTML error page. Returns null so
 * callers keep their existing null-tolerant behavior; the log preserves the
 * cause that a bare `Gagal (500)` would otherwise swallow. Empty bodies
 * resolve to null silently.
 */
export async function upstreamJson(res: Response, route: string): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    console.error(`[bff:${route}] upstream non-JSON (status ${res.status}): ${text.slice(0, 200)}`);
    return null;
  }
}

export function cookieFlags(maxAge: number) {
  return {
    httpOnly: true as const,
    path: '/',
    maxAge,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export interface SessionUser {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  /** Present when the backend knows the TOTP flag; absent on older responses. */
  totpEnabled?: boolean;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Server-side refresh against the backend. No cookie side effects — callers
 * that CAN set cookies (route handlers) persist the result themselves; server
 * components use it read-only to avoid bouncing an otherwise-live session.
 */
export async function tryServerRefresh(refreshToken: string): Promise<RefreshResult | null> {
  try {
    const res = await backend('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      accessToken?: unknown;
      refreshToken?: unknown;
    } | null;
    if (
      !body ||
      typeof body.accessToken !== 'string' ||
      body.accessToken.length === 0 ||
      typeof body.refreshToken !== 'string' ||
      body.refreshToken.length === 0
    ) {
      return null;
    }
    return { accessToken: body.accessToken, refreshToken: body.refreshToken };
  } catch {
    return null;
  }
}
