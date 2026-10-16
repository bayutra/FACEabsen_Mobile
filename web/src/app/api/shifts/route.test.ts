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

import { POST as createShift } from './route';
import { DELETE as removeShift, PATCH as patchShift } from './[id]/route';

function req(body: unknown) {
  return new Request('http://web/api/shifts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function sentBody() {
  const init = backend.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

describe('BFF /api/shifts POST', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
  });

  it('coerces numeric thresholds and forwards the access token', async () => {
    const res = await createShift(
      req({
        hospitalId: 'h1',
        name: 'MALAM',
        startTime: '23:00',
        endTime: '07:00',
        gracePeriodMin: '10',
        lateThresholdMin: '45',
        earlyCheckoutThresholdMin: '',
      }),
    );

    expect(res.status).toBe(201);
    const body = sentBody();
    expect(body.gracePeriodMin).toBe(10);
    expect(body.lateThresholdMin).toBe(45);
    // Blank numeric input is dropped rather than sent as NaN.
    expect('earlyCheckoutThresholdMin' in body).toBe(false);

    const init = backend.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('never forwards a client-supplied overnight flag', async () => {
    await createShift(
      req({ hospitalId: 'h1', name: 'PAGI', startTime: '07:00', endTime: '15:00', overnight: true }),
    );
    expect('overnight' in sentBody()).toBe(false);
  });

  it('strips unknown fields instead of passing them through', async () => {
    await createShift(
      req({
        hospitalId: 'h1',
        name: 'PAGI',
        startTime: '07:00',
        endTime: '15:00',
        isSuperAdmin: true,
        __proto__pollution: 'x',
      }),
    );
    expect(Object.keys(sentBody()).sort()).toEqual(['endTime', 'hospitalId', 'name', 'startTime']);
  });

  it('rejects a non-object body with 400', async () => {
    const res = await createShift(
      new Request('http://web/api/shifts', { method: 'POST', body: '"nope"' }),
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('BFF /api/shifts/[id]', () => {
  beforeEach(() => {
    backend.mockClear();
    backend.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  const ctx = { params: Promise.resolve({ id: 's1' }) };

  it('patches a partial retune with coerced numbers', async () => {
    await patchShift(
      new Request('http://web/api/shifts/s1', {
        method: 'PATCH',
        body: JSON.stringify({ lateThresholdMin: '45' }),
      }),
      ctx,
    );

    expect(backend.mock.calls[0]?.[0]).toBe('/shifts/s1');
    expect(sentBody()).toEqual({ lateThresholdMin: 45 });
  });

  it('rejects an empty patch instead of firing a no-op request', async () => {
    const res = await patchShift(
      new Request('http://web/api/shifts/s1', {
        method: 'PATCH',
        body: JSON.stringify({ overnight: true, junk: 'x' }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it('encodes the id and forwards the status on delete', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Shift is still on a roster and cannot be deleted' }), {
        status: 409,
      }),
    );

    const res = await removeShift(new Request('http://web/api/shifts/s1'), {
      params: Promise.resolve({ id: 's/1' }),
    });

    expect(res.status).toBe(409);
    expect(backend.mock.calls[0]?.[0]).toBe('/shifts/s%2F1');
    expect((backend.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
    expect((await res.json()).message).toContain('still on a roster');
  });
});