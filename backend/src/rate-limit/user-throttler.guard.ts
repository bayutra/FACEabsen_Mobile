import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

 
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const path: string = typeof req.path === 'string' ? req.path : '';
    const body: unknown = (req as { body?: unknown }).body;
    if (path.includes('/auth/login') && isRecord(body) && typeof body.email === 'string' && body.email.length > 0) {
      return `auth-email:${body.email.trim().toLowerCase()}`;
    }
    if (
      path.includes('/auth/refresh') &&
      isRecord(body) &&
      typeof body.refreshToken === 'string' &&
      body.refreshToken.length >= 8
    ) {
      return `auth-refresh:${body.refreshToken.slice(0, 12)}`;
    }
    const sub = bearerSub((req as { headers?: unknown }).headers);
    if (sub) return `user-${sub}`;
    return super.getTracker(req);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

 
function bearerSub(headers: unknown): string | undefined {
  if (!isRecord(headers)) return undefined;
  const auth = headers['authorization'];
  if (typeof auth !== 'string') return undefined;
  const m = /^Bearer ([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(auth.trim());
  if (!m) return undefined;
  try {
    const payload: unknown = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString('utf8'));
    if (isRecord(payload) && typeof payload.sub === 'string' && payload.sub.length > 0) {
      return payload.sub;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
