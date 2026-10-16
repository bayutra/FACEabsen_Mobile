import { describe, expect, it, vi } from 'vitest';
import { backend, passthroughJson, upstreamJson } from './api';

describe('passthroughJson', () => {
  it('returns an empty 204 instead of throwing on a body', async () => {
    const res = passthroughJson({ hapus: true }, 204);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('passes JSON bodies through with the backend status', async () => {
    const res = passthroughJson({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('backend timeout', () => {
  it('attaches an abort signal and honors a caller-owned one', async () => {
    const seen: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        seen.push(init ?? {});
        return new Response('{}', { status: 200 });
      }),
    );
    try {
      await backend('/auth/me', { headers: { Authorization: 'Bearer x' } });
      expect(seen).toHaveLength(1);
      expect(seen[0].signal).toBeInstanceOf(AbortSignal);

      const own = new AbortController().signal;
      await backend('/auth/me', { signal: own });
      expect(seen[1].signal).toBe(own);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('aborts a hanging backend past the budget', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Timeout', 'TimeoutError')),
            );
          }),
      ),
    );
    try {
      await expect(backend('/reports/monthly?month=2026-10', {}, 50)).rejects.toThrow(
        /Timeout/i,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('upstreamJson', () => {
  it('parses JSON, returns null silently on empty bodies', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await upstreamJson(new Response('{"a":1}', { status: 200 }), 'x')).toEqual({ a: 1 });
      expect(await upstreamJson(new Response('', { status: 200 }), 'x')).toBeNull();
      expect(err).not.toHaveBeenCalled();
    } finally {
      err.mockRestore();
    }
  });

  it('logs the raw snippet when upstream sends non-JSON', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const out = await upstreamJson(
        new Response('<html>Bad Gateway</html>', { status: 502 }),
        'reports',
      );
      expect(out).toBeNull();
      expect(err).toHaveBeenCalledWith(expect.stringContaining('[bff:reports]'));
      expect(err).toHaveBeenCalledWith(expect.stringContaining('Bad Gateway'));
    } finally {
      err.mockRestore();
    }
  });
});
