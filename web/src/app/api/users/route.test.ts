import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(
  async () => new Response(JSON.stringify({}), { status: 201 }),
);

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'tok-123' }) }),
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

import { POST as createUser } from './route';
import { PATCH as patchUser } from './[id]/route';
import { POST as resetPassword } from './[id]/reset-password/route';

function sentBody() {
  const init = backend.mock.calls[0]?.[1];
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

function post(body: unknown) {
  return new Request('http://web/api/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('BFF /api/users POST', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
  });

  it('trims the email but never trims the password', async () => {
    await createUser(
      post({ email: ' it@rs.test ', password: '  Password123!  ', roles: ['SUPERVISOR'] }),
    );

    expect(sentBody()).toEqual({
      email: 'it@rs.test',
      password: '  Password123!  ',
      roles: ['SUPERVISOR'],
    });
  });

  it('drops non-string roles and unknown fields', async () => {
    await createUser(
      post({ email: 'x@rs.test', password: 'Password123!', roles: [1, 'ADMIN'], isSuperAdmin: true }),
    );
    // Junk entries are stripped so one bad value cannot fail the whole DTO.
    expect(sentBody().roles).toEqual(['ADMIN']);
    expect('isSuperAdmin' in sentBody()).toBe(false);
  });

  it('omits roles entirely when nothing valid is left', async () => {
    await createUser(post({ email: 'x@rs.test', password: 'Password123!', roles: [1, null] }));
    expect('roles' in sentBody()).toBe(false);
  });

  it('rejects a non-object body with 400', async () => {
    const res = await createUser(new Request('http://web/api/users', { method: 'POST', body: 'null' }));
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('BFF /api/users/[id] PATCH', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  const ctx = { params: Promise.resolve({ id: 'u1' }) };

  it('accepts an activation toggle', async () => {
    await patchUser(
      new Request('http://web/api/users/u1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      ctx,
    );
    expect(backend.mock.calls[0]?.[0]).toBe('/users/u1');
    expect(sentBody()).toEqual({ isActive: false });
  });

  it('rejects an empty role array before hitting the API', async () => {
    const res = await patchUser(
      new Request('http://web/api/users/u1', {
        method: 'PATCH',
        body: JSON.stringify({ roles: [] }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it('rejects a no-op patch', async () => {
    const res = await patchUser(
      new Request('http://web/api/users/u1', {
        method: 'PATCH',
        body: JSON.stringify({ email: 'x@rs.test' }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it('passes a 403 rank-guard refusal through unchanged', async () => {
    backend.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Cannot administer an account at or above your own rank' }),
        { status: 403 },
      ),
    );
    const res = await patchUser(
      new Request('http://web/api/users/u1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('at or above your own rank');
  });
});

describe('BFF /api/users/[id]/reset-password', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  const ctx = { params: Promise.resolve({ id: 'u1' }) };

  it('posts to the reset endpoint and encodes the id', async () => {
    await resetPassword(
      new Request('http://web/api/users/u/1/reset-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'Password123!' }),
      }),
      { params: Promise.resolve({ id: 'u/1' }) },
    );
    expect(backend.mock.calls[0]?.[0]).toBe('/users/u%2F1/reset-password');
    expect(sentBody()).toEqual({ password: 'Password123!' });
  });

  it('rejects a too-short password locally', async () => {
    const res = await resetPassword(
      new Request('http://web/api/users/u1/reset-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'short' }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});