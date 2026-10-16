import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response(JSON.stringify({}), { status: 200 }),
);

const cookieSet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (...args: unknown[]) => cookieSet(...args),
  }),
}));

vi.mock('@/lib/api', () => ({
  ACCESS_COOKIE: 'access_token',
  REFRESH_COOKIE: 'refresh_token',
  ACCESS_MAX_AGE: 900,
  REFRESH_MAX_AGE: 604800,
  backend: (path: string, init?: RequestInit) => backend(path, init),
  cookieFlags: (maxAge: number) => ({ httpOnly: true, path: '/', maxAge, sameSite: 'lax' }),
  upstreamJson: (res: Response) => res.json().catch(() => null),
}));

import { POST as login } from './route';

function req(email: unknown, password: unknown) {
  return new Request('http://web/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

function fail(status: number, message: string) {
  backend.mockResolvedValue(new Response(JSON.stringify({ message }), { status }));
}

describe('BFF /api/auth/login POST', () => {
  beforeEach(() => {
    backend.mockClear();
    cookieSet.mockClear();
    backend.mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1', roles: ['ADMIN'] } }),
        { status: 200 },
      ),
    );
  });

  it('masks 401 wrong-credentials as a generic message', async () => {
    fail(401, 'Invalid credentials');
    const res = await login(req('x@rs.test', 'salah'));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('Email atau password salah');
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('masks a 400 validation failure the same way', async () => {
    fail(400, 'email must be an email');
    const res = await login(req('bukan-email', 'Password123!'));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('Email atau password salah');
  });

  it('passes a 403 lockout through with the backend message', async () => {
    fail(403, 'Account temporarily locked. Try again later.');
    const res = await login(req('x@rs.test', 'Password123!'));
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('temporarily locked');
  });

  it('passes 423 and 429 through with the backend message', async () => {
    fail(423, 'Akun terkunci sementara.');
    const locked = await login(req('x@rs.test', 'Password123!'));
    expect(locked.status).toBe(423);
    expect((await locked.json()).message).toContain('terkunci');

    fail(429, 'Terlalu banyak percobaan. Coba lagi nanti.');
    const limited = await login(req('x@rs.test', 'Password123!'));
    expect(limited.status).toBe(429);
    expect((await limited.json()).message).toContain('Terlalu banyak');
  });

  it('returns 502 when the success body has no access token', async () => {
    backend.mockResolvedValue(new Response(JSON.stringify({ user: { id: 'u1' } }), { status: 200 }));
    const res = await login(req('x@rs.test', 'Password123!'));
    expect(res.status).toBe(502);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('sets both cookies and returns the user on success', async () => {
    const res = await login(req('x@rs.test', 'Password123!'));
    expect(res.status).toBe(200);
    expect((await res.json()).user).toEqual({ id: 'u1', roles: ['ADMIN'] });
    expect(cookieSet).toHaveBeenCalledTimes(2);
  });

  it('blocks EMPLOYEE-only accounts without creating a session', async () => {
    backend.mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'a',
          refreshToken: 'r',
          user: { id: 'u9', roles: ['EMPLOYEE'] },
        }),
        { status: 200 },
      ),
    );
    const res = await login(req('karyawan@rs.test', 'Password123!'));
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('mobile');
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('passes a TOTP challenge through without setting cookies', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ totpRequired: true, totpToken: 't', expiresIn: 300 }), {
        status: 200,
      }),
    );
    const res = await login(req('x@rs.test', 'Password123!'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ totpRequired: true, totpToken: 't', expiresIn: 300 });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('rejects a non-string body with 400', async () => {
    const res = await login(
      new Request('http://web/api/auth/login', { method: 'POST', body: 'null' }),
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});
