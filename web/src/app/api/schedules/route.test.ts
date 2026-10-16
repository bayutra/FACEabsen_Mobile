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

import { POST as createSchedule } from './route';
import { DELETE as removeSchedule } from './[id]/route';

function sentBody() {
  const init = backend.mock.calls[0]?.[1];
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

function post(body: unknown) {
  return new Request('http://web/api/schedules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('BFF /api/schedules POST', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
  });

  it('forwards the whitelisted fields and trims them', async () => {
    const res = await createSchedule(
      post({ employeeId: ' e1 ', shiftId: ' s1 ', workDate: ' 2026-10-09 ', extra: 'x' }),
    );

    expect(res.status).toBe(201);
    expect(sentBody()).toEqual({ employeeId: 'e1', shiftId: 's1', workDate: '2026-10-09' });
    const init = backend.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('rejects a malformed date before hitting the API', async () => {
    const res = await createSchedule(
      post({ employeeId: 'e1', shiftId: 's1', workDate: '09/10/2026' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('YYYY-MM-DD');
    expect(backend).not.toHaveBeenCalled();
  });

  it('rejects a partial body', async () => {
    const res = await createSchedule(post({ employeeId: 'e1', shiftId: 's1' }));
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it('rejects a non-object body', async () => {
    const res = await createSchedule(
      new Request('http://web/api/schedules', { method: 'POST', body: 'null' }),
    );
    expect(res.status).toBe(400);
  });

  it('passes a same-day duplicate conflict through', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Employee already scheduled on this date' }), {
        status: 409,
      }),
    );
    const res = await createSchedule(
      post({ employeeId: 'e1', shiftId: 's1', workDate: '2026-10-09' }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain('already scheduled');
  });
});

describe('BFF /api/schedules/[id] DELETE', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({ removed: true }), { status: 200 }));
  });

  it('deletes and encodes the id', async () => {
    const res = await removeSchedule(new Request('http://web/api/schedules/x'), {
      params: Promise.resolve({ id: 'x' }),
    });

    expect(res.status).toBe(200);
    expect(backend.mock.calls[0]?.[0]).toBe('/schedules/x');
    expect((backend.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
    expect((await res.json()).removed).toBe(true);
  });

  it('surfaces the history-protection refusal', async () => {
    backend.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Schedule has attendance and cannot be removed' }),
        { status: 409 },
      ),
    );
    const res = await removeSchedule(new Request('http://web/api/schedules/x'), {
      params: Promise.resolve({ id: 'x' }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain('cannot be removed');
  });
});