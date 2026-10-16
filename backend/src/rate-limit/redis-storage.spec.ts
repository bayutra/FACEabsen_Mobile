import { describe, expect, it } from 'vitest';
import { RedisThrottlerStorage, type RateStore } from './redis-storage.js';

function fakeStore(): RateStore & { calls: string[] } {
  const counts = new Map<string, number>();
  const calls: string[] = [];
  return {
    calls,
    incr: async (k: string) => {
      calls.push(`incr:${k}`);
      const n = (counts.get(k) ?? 0) + 1;
      counts.set(k, n);
      return n;
    },
    expire: async (k: string, s: number) => {
      calls.push(`expire:${k}:${s}`);
      return 1;
    },
    ttl: async () => 60,
  };
}

describe('RedisThrottlerStorage (STEP 25)', () => {
  it('counts fixed-window hits and blocks past the limit', async () => {
    const store = fakeStore();
    const svc = new RedisThrottlerStorage(store);
    const r1 = await svc.increment('k', 60_000, 2, 0, 'default');
    expect(r1).toMatchObject({ totalHits: 1, isBlocked: false });
    const r2 = await svc.increment('k', 60_000, 2, 0, 'default');
    expect(r2.isBlocked).toBe(false);
    const r3 = await svc.increment('k', 60_000, 2, 0, 'default');
    expect(r3).toMatchObject({ totalHits: 3, isBlocked: true });
  });

  it('fails open when Redis is unreachable', async () => {
    const store: RateStore = {
      incr: async () => {
        throw new Error('ECONNREFUSED');
      },
      expire: async () => 1,
      ttl: async () => 60,
    };
    const svc = new RedisThrottlerStorage(store);
    const r = await svc.increment('k', 60_000, 1, 0, 'default');
    expect(r.isBlocked).toBe(false);
    expect(r.totalHits).toBe(1);
  });
});
