import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response(JSON.stringify({}), { status: 200 }),
);

const cookieSet = vi.fn();
const cookieDelete = vi.fn();

let refreshToken: string | undefined = 'live-refresh';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'refresh_token' && refreshToken ? { value: refreshToken } : undefined),
    set: (...args: unknown[]) => cookieSet(...args),
    delete: (...args: unknown[]) => cookieDelete(...args),
  }),
}));

vi.mock('@/lib/api', () => ({
  ACCESS_COOKIE: 'access_token',
  REFRESH_COOKIE: 'refresh_token',
  ACCESS_MAX_AGE: 900,
  REFRESH_MAX_AGE: 604800,
  backend: (path: string, init?: RequestInit) => backend(path, init),
  cookieFlags: (maxAge: number) => ({ httpOnly: true, path: '/', maxAge, sameSite: 'lax' }),
}));

import { GET as refreshGet, POST as refresh } from './route';

describe('BFF /api/auth/refresh POST', () => {
  beforeEach(() => {
    backend.mockClear();
    cookieSet.mockClear();
    cookieDelete.mockClear();
    refreshToken = 'live-refresh';
    backend.mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'a2', refreshToken: 'r2' }), { status: 200 }),
    );
  });

  it('rotates both cookies on success', async () => {
    const res = await refresh();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(backend).toHaveBeenCalledWith(
      '/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(cookieSet).toHaveBeenCalledTimes(2);
    expect(cookieDelete).not.toHaveBeenCalled();
  });

  it('returns 401 without hitting the backend when the cookie is missing', async () => {
    refreshToken = undefined;
    const res = await refresh();
    expect(res.status).toBe(401);
    expect(backend).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('clears both cookies when the backend refuses the refresh', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ message: 'refresh expired' }), { status: 401 }),
    );
    const res = await refresh();
    expect(res.status).toBe(401);
    expect(cookieDelete).toHaveBeenCalledWith('access_token');
    expect(cookieDelete).toHaveBeenCalledWith('refresh_token');
    expect(cookieSet).not.toHaveBeenCalled();
  });
});

describe('BFF /api/auth/refresh GET (navigasi layout)', () => {
  beforeEach(() => {
    backend.mockClear();
    cookieSet.mockClear();
    cookieDelete.mockClear();
    refreshToken = 'live-refresh';
    backend.mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'a2', refreshToken: 'r2' }), { status: 200 }),
    );
  });

  function getReq(referer?: string) {
    const headers: Record<string, string> = {};
    if (referer !== undefined) headers.referer = referer;
    return new Request('http://web/api/auth/refresh', { headers });
  }

  it('rotates, persists cookies, and returns to the same-origin referer', async () => {
    const res = await refreshGet(getReq('http://web/attendance?page=2'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://web/attendance?page=2');
    expect(cookieSet).toHaveBeenCalledTimes(2);
  });

  it('falls back to /dashboard for cross-origin or API referers', async () => {
    const ok = () =>
      backend.mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'a2', refreshToken: 'r2' }), { status: 200 }),
      );
    ok();
    const evil = await refreshGet(getReq('https://evil.test/attendance'));
    expect(evil.headers.get('location')).toBe('http://web/dashboard');

    ok();
    const api = await refreshGet(getReq('http://web/api/auth/me'));
    expect(api.headers.get('location')).toBe('http://web/dashboard');
  });

  it('clears cookies and goes to /login when rotation fails', async () => {
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 401 }));
    const res = await refreshGet(getReq('http://web/attendance'));
    expect(res.headers.get('location')).toBe('http://web/login');
    expect(cookieDelete).toHaveBeenCalledWith('access_token');
    expect(cookieDelete).toHaveBeenCalledWith('refresh_token');
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
