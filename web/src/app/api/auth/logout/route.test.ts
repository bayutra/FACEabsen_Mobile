import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response(JSON.stringify({}), { status: 200 }),
);

const cookieDelete = vi.fn();

let accessToken: string | undefined = 'live-access';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'access_token' && accessToken ? { value: accessToken } : undefined),
    delete: (...args: unknown[]) => cookieDelete(...args),
  }),
}));

vi.mock('@/lib/api', () => ({
  ACCESS_COOKIE: 'access_token',
  REFRESH_COOKIE: 'refresh_token',
  backend: (path: string, init?: RequestInit) => backend(path, init),
}));

import { POST as logout } from './route';

describe('BFF /api/auth/logout POST', () => {
  beforeEach(() => {
    backend.mockClear();
    cookieDelete.mockClear();
    accessToken = 'live-access';
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  it('notifies the backend then clears both cookies', async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(backend).toHaveBeenCalledWith(
      '/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(cookieDelete).toHaveBeenCalledWith('access_token');
    expect(cookieDelete).toHaveBeenCalledWith('refresh_token');
  });

  it('still clears both cookies when the backend is down', async () => {
    backend.mockRejectedValue(new Error('backend down'));
    const res = await logout();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(cookieDelete).toHaveBeenCalledWith('access_token');
    expect(cookieDelete).toHaveBeenCalledWith('refresh_token');
  });

  it('skips the backend call without a session but still clears cookies', async () => {
    accessToken = undefined;
    const res = await logout();
    expect(res.status).toBe(200);
    expect(backend).not.toHaveBeenCalled();
    expect(cookieDelete).toHaveBeenCalledWith('access_token');
    expect(cookieDelete).toHaveBeenCalledWith('refresh_token');
  });
});
