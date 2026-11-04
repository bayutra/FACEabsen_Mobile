import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/**
 * Key trackers are hashed so Redis never stores raw emails, refresh tokens, or
 * user ids. Auth endpoints are keyed by IP + account: one attacker cannot lock
 * an account from a single IP for everyone behind a different NAT, and a single
 * IP cannot spray unlimited accounts without hitting its own bucket.
 */
function trackerDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const path: string = typeof req.path === 'string' ? req.path : '';
    const body: unknown = (req as { body?: unknown }).body;
    const ip =
      typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : 'unknown';

    let account: string | undefined;
    if (
      path.includes('/auth/login') &&
      isRecord(body) &&
      typeof body.email === 'string' &&
      body.email.length > 0
    ) {
      account = `email:${body.email.trim().toLowerCase()}`;
    } else if (
      path.includes('/auth/refresh') &&
      isRecord(body) &&
      typeof body.refreshToken === 'string' &&
      body.refreshToken.length >= 8
    ) {
      account = `refresh:${body.refreshToken}`;
    }

    if (account) {
      return `auth-${trackerDigest(`${ip}|${account}`)}`;
    }

    const sub = bearerSub((req as { headers?: unknown }).headers);
    if (sub) return `user-${trackerDigest(sub)}`;

    const fallback = await super.getTracker(req);
    return `ip-${trackerDigest(fallback)}`;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function bearerSub(headers: unknown): string | undefined {
  if (!isRecord(headers)) return undefined;
  const auth = headers['authorization'];
  if (typeof auth !== 'string') return undefined;
  const m = /^Bearer ([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(
    auth.trim(),
  );
  if (!m) return undefined;
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(m[1].split('.')[1], 'base64url').toString('utf8'),
    );
    if (
      isRecord(payload) &&
      typeof payload.sub === 'string' &&
      payload.sub.length > 0
    ) {
      return payload.sub;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
