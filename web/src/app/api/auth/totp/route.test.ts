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

import { POST as verify } from './verify/route';
import { POST as recover } from './recover/route';

function jsonReq(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
}

describe('BFF /api/auth/totp/verify POST', () => {
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

  it('sets both cookies and returns the user on success', async () => {
    const res = await verify(jsonReq('http://web/api/auth/totp/verify', { totpToken: 't', code: '123456' }));
    expect(res.status).toBe(200);
    expect((await res.json()).user).toEqual({ id: 'u1', roles: ['ADMIN'] });
    expect(cookieSet).toHaveBeenCalledTimes(2);
    expect(backend).toHaveBeenCalledWith(
      '/auth/totp/verify',
      expect.objectContaining({ method: 'POST' }),
    );
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
    const res = await verify(jsonReq('http://web/api/auth/totp/verify', { totpToken: 't', code: '123456' }));
    expect(res.status).toBe(403);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('passes a 401 wrong-code through with the backend message', async () => {
    backend.mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid code' }), { status: 401 }));
    const res = await verify(jsonReq('http://web/api/auth/totp/verify', { totpToken: 't', code: '000000' }));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('Invalid code');
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('returns 502 when the success body has no access token', async () => {
    backend.mockResolvedValue(new Response(JSON.stringify({ user: { id: 'u1' } }), { status: 200 }));
    const res = await verify(jsonReq('http://web/api/auth/totp/verify', { totpToken: 't', code: '123456' }));
    expect(res.status).toBe(502);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('rejects a non-string body with 400', async () => {
    const res = await verify(jsonReq('http://web/api/auth/totp/verify', { totpToken: 1, code: null }));
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('BFF /api/auth/totp/recover POST', () => {
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

  it('sets both cookies and returns the user on success', async () => {
    const res = await recover(
      jsonReq('http://web/api/auth/totp/recover', { totpToken: 't', recoveryCode: 'ABCD-EFGHIJ' }),
    );
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
    const res = await recover(
      jsonReq('http://web/api/auth/totp/recover', { totpToken: 't', recoveryCode: 'ABCD-EFGHIJ' }),
    );
    expect(res.status).toBe(403);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('passes a 401 consumed-code through with the backend message', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid recovery code' }), { status: 401 }),
    );
    const res = await recover(
      jsonReq('http://web/api/auth/totp/recover', { totpToken: 't', recoveryCode: 'XXXX-XXXXXX' }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('Invalid recovery code');
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('rejects a non-string body with 400', async () => {
    const res = await recover(jsonReq('http://web/api/auth/totp/recover', { totpToken: 't' }));
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});
