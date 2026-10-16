import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response(JSON.stringify({}), { status: 200 }),
);

let token: string | undefined = 'session-token';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (token ? { value: token } : undefined),
    set: () => {},
  }),
}));

vi.mock('@/lib/api', () => ({
  ACCESS_COOKIE: 'access_token',
  backend: (path: string, init?: RequestInit) => backend(path, init),
  passthroughJson: (body: unknown, status: number) =>
    status === 204
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
  upstreamJson: (res: Response) => res.json().catch(() => null),
}));

import { POST as setup } from './setup/route';
import { POST as enable } from './enable/route';
import { POST as disable } from './disable/route';

function jsonReq(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
}

describe('BFF /api/auth/totp/setup POST', () => {
  beforeEach(() => {
    backend.mockClear();
    token = 'session-token';
    backend.mockResolvedValue(
      new Response(
        JSON.stringify({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x' }),
        { status: 200 },
      ),
    );
  });

  it('forwards the bearer token and passes the secret through', async () => {
    const res = await setup();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x' });
    expect(backend).toHaveBeenCalledWith(
      '/auth/totp/setup',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
      }),
    );
  });

  it('rejects without a session cookie', async () => {
    token = undefined;
    const res = await setup();
    expect(res.status).toBe(401);
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('BFF /api/auth/totp/enable POST', () => {
  const codes = ['AAAA-BBBBBB', 'CCCC-DDDDDD', 'EEEE-FFFFFF', 'GGGG-HHHHHH', 'JJJJ-KKKKKK', 'MMMM-NNNNNN', 'PPPP-QQQQQQ', 'RRRR-SSSSSS'];

  beforeEach(() => {
    backend.mockClear();
    token = 'session-token';
    backend.mockResolvedValue(new Response(JSON.stringify({ recoveryCodes: codes }), { status: 200 }));
  });

  it('returns the 8 recovery codes on success', async () => {
    const res = await enable(jsonReq('http://web/api/auth/totp/enable', { code: '123456' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recoveryCodes).toHaveLength(8);
    expect(body.recoveryCodes).toEqual(codes);
  });

  it('passes a 401 wrong-code through with the backend message', async () => {
    backend.mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid code' }), { status: 401 }));
    const res = await enable(jsonReq('http://web/api/auth/totp/enable', { code: '000000' }));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('Invalid code');
  });

  it('rejects a missing code with 400', async () => {
    const res = await enable(jsonReq('http://web/api/auth/totp/enable', {}));
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it('rejects without a session cookie', async () => {
    token = undefined;
    const res = await enable(jsonReq('http://web/api/auth/totp/enable', { code: '123456' }));
    expect(res.status).toBe(401);
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('BFF /api/auth/totp/disable POST', () => {
  beforeEach(() => {
    backend.mockClear();
    token = 'session-token';
    backend.mockResolvedValue(new Response(JSON.stringify({ disabled: true }), { status: 200 }));
  });

  it('passes the disabled flag through', async () => {
    const res = await disable(
      jsonReq('http://web/api/auth/totp/disable', { password: 'Password123!' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ disabled: true });
  });

  it('passes a 401 wrong-password through with the backend message', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Current password is incorrect' }), { status: 401 }),
    );
    const res = await disable(jsonReq('http://web/api/auth/totp/disable', { password: 'salah' }));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('Current password is incorrect');
  });

  it('rejects a missing password with 400', async () => {
    const res = await disable(jsonReq('http://web/api/auth/totp/disable', {}));
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});
