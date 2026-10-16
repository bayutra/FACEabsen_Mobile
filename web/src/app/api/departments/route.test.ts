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

import { POST as createDepartment } from './route';
import { DELETE as removeDepartment, PATCH as patchDepartment } from './[id]/route';

function sentBody() {
  const init = backend.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

describe('BFF /api/departments POST', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
  });

  it('forwards only the whitelisted, trimmed fields', async () => {
    const res = await createDepartment(
      new Request('http://web/api/departments', {
        method: 'POST',
        body: JSON.stringify({ hospitalId: ' h1 ', name: ' Radiologi ', evil: true }),
      }),
    );

    expect(res.status).toBe(201);
    expect(sentBody()).toEqual({ hospitalId: 'h1', name: 'Radiologi' });
    const init = backend.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('drops blank strings so the backend rejects them, not a silent empty row', async () => {
    await createDepartment(
      new Request('http://web/api/departments', {
        method: 'POST',
        body: JSON.stringify({ hospitalId: 'h1', name: '   ' }),
      }),
    );
    expect(sentBody()).toEqual({ hospitalId: 'h1' });
  });

  it('rejects a non-object body with 400', async () => {
    const res = await createDepartment(
      new Request('http://web/api/departments', { method: 'POST', body: 'null' }),
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('BFF /api/departments/[id]', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  const ctx = { params: Promise.resolve({ id: 'd1' }) };

  it('patches the name', async () => {
    await patchDepartment(
      new Request('http://web/api/departments/d1', {
        method: 'PATCH',
        body: JSON.stringify({ name: ' Radiologi ' }),
      }),
      ctx,
    );
    expect(backend.mock.calls[0]?.[0]).toBe('/departments/d1');
    expect(sentBody()).toEqual({ name: 'Radiologi' });
  });

  it('refuses an empty rename locally', async () => {
    const res = await patchDepartment(
      new Request('http://web/api/departments/d1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  ' }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it('passes the delete conflict reason through to the client', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Department still has 2 employee assigned; move them first' }), {
        status: 409,
      }),
    );

    const res = await removeDepartment(new Request('http://web/api/departments/d1'), ctx);

    expect(res.status).toBe(409);
    expect((backend.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
    expect((await res.json()).message).toContain('still has 2 employee');
  });
});