import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response(JSON.stringify({}), { status: 200 }),
);

const tryServerRefresh = vi.fn<() => Promise<{ accessToken: string; refreshToken: string } | null>>(
  async () => null,
);

const cookieSet = vi.fn();
const cookieDelete = vi.fn();

let accessToken: string | undefined = 'live-access';
let refreshToken: string | undefined = 'live-refresh';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === 'access_token' ? accessToken : refreshToken;
      return value ? { value } : undefined;
    },
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
  tryServerRefresh: () => tryServerRefresh(),
  passthroughJson: (body: unknown, status: number) =>
    status === 204
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
  upstreamJson: (res: Response) => res.json().catch(() => null),
}));

import { GET as me } from './route';

function userRes(user: unknown) {
  return new Response(JSON.stringify(user), { status: 200 });
}

describe('BFF /api/auth/me GET', () => {
  beforeEach(() => {
    backend.mockClear();
    tryServerRefresh.mockClear();
    cookieSet.mockClear();
    cookieDelete.mockClear();
    accessToken = 'live-access';
    refreshToken = 'live-refresh';
    backend.mockResolvedValue(userRes({ id: 'u1', roles: ['ADMIN'] }));
    tryServerRefresh.mockResolvedValue(null);
  });

  it('proxies the user with a valid token', async () => {
    const res = await me();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'u1', roles: ['ADMIN'] });
    expect(backend).toHaveBeenCalledWith(
      '/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer live-access' }),
      }),
    );
    expect(tryServerRefresh).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('rotates cookies and retries when access is dead but refresh is live', async () => {
    backend
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'jwt expired' }), { status: 401 }))
      .mockResolvedValueOnce(userRes({ id: 'u1', roles: ['ADMIN'] }));
    tryServerRefresh.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });

    const res = await me();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'u1', roles: ['ADMIN'] });
    expect(tryServerRefresh).toHaveBeenCalledTimes(1);
    expect(cookieSet).toHaveBeenCalledTimes(2);
    expect(backend).toHaveBeenLastCalledWith(
      '/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer a2' }),
      }),
    );
  });

  it('returns 401 without hitting the backend when no session exists', async () => {
    accessToken = undefined;
    refreshToken = undefined;
    const res = await me();
    expect(res.status).toBe(401);
    expect(backend).not.toHaveBeenCalled();
    expect(tryServerRefresh).not.toHaveBeenCalled();
  });

  it('clears both cookies when the refresh token is dead', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ message: 'jwt expired' }), { status: 401 }),
    );
    tryServerRefresh.mockResolvedValue(null);
    const res = await me();
    expect(res.status).toBe(401);
    expect(cookieDelete).toHaveBeenCalledWith('access_token');
    expect(cookieDelete).toHaveBeenCalledWith('refresh_token');
  });
});
