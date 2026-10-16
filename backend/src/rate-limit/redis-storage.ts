import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

interface ThrottlerRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/** Minimal surface the storage needs (ioredis satisfies this; fakes do too). */
export interface RateStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

/**
 * STEP 25 — shared rate-limit storage for multi-instance production.
 * Fixed window per throttler key. Fails OPEN with a warning if Redis is
 * unreachable (a limiter outage must not become a self-inflicted DoS).
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly store: RateStore) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerRecord> {
    try {
      const totalHits = await this.store.incr(key);
      if (totalHits === 1) {
        await this.store.expire(key, Math.max(1, Math.ceil(ttl / 1000)));
      }
      const blocked = totalHits > limit;
      if (blocked && blockDuration > 0) {
        await this.store.expire(key, Math.max(1, Math.ceil(blockDuration / 1000)));
      }
      const ttlSec = await this.store.ttl(key);
      const timeToExpire = ttlSec > 0 ? ttlSec * 1000 : ttl;
      return { totalHits, timeToExpire, isBlocked: blocked, timeToBlockExpire: blocked ? timeToExpire : 0 };
    } catch (e) {
      this.logger.warn(`Rate-limit store unreachable, failing open: ${(e as Error).message}`);
      return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
