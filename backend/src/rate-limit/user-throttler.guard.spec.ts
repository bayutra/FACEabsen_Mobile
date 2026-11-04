import { describe, expect, it } from 'vitest';
import { UserThrottlerGuard } from './user-throttler.guard.js';

const guard = new UserThrottlerGuard() as unknown as {
  getTracker(req: Record<string, any>): Promise<string>;
};

function jwt(sub: string): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ sub })}.sig`;
}

describe('UserThrottlerGuard.getTracker', () => {
  it('keys login by IP + account email (case-insensitive) and hashes both', async () => {
    const a = await guard.getTracker({
      path: '/api/v1/auth/login',
      ip: '10.0.0.1',
      body: { email: 'Nurse@Rs.Test' },
    });
    const b = await guard.getTracker({
      path: '/api/v1/auth/login',
      ip: '10.0.0.1',
      body: { email: 'nurse@rs.test' },
    });
    const otherIp = await guard.getTracker({
      path: '/api/v1/auth/login',
      ip: '10.0.0.2',
      body: { email: 'nurse@rs.test' },
    });
    expect(a).toBe(b);
    expect(a).not.toBe(otherIp);
    expect(a.startsWith('auth-')).toBe(true);
    expect(a).not.toContain('nurse@rs.test');
    expect(a).not.toContain('10.0.0.1');
  });

  it('keys refresh by IP + token and never stores the token raw', async () => {
    const a = await guard.getTracker({
      path: '/api/v1/auth/refresh',
      ip: '10.0.0.1',
      body: { refreshToken: 'abcdefghijklmnop' },
    });
    const b = await guard.getTracker({
      path: '/api/v1/auth/refresh',
      ip: '10.0.0.1',
      body: { refreshToken: 'abcdefghijklmnop' },
    });
    const c = await guard.getTracker({
      path: '/api/v1/auth/refresh',
      ip: '10.0.0.1',
      body: { refreshToken: 'zzzzzzzzzzzzzzzz' },
    });
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(a.startsWith('auth-')).toBe(true);
    expect(a).not.toContain('abcdefghijklmnop');
  });

  it('keys authenticated requests per JWT sub, hashed', async () => {
    const a = await guard.getTracker({
      path: '/api/v1/attendance/check-in',
      headers: { authorization: `Bearer ${jwt('u1')}` },
    });
    const forged = await guard.getTracker({
      path: '/api/v1/attendance/check-in',
      headers: { authorization: `Bearer ${jwt('attacker')}` },
    });
    expect(a).not.toBe(forged);
    expect(a.startsWith('user-')).toBe(true);
    expect(a).not.toContain('u1');
  });

  it('falls back to a hashed IP with no usable identity', async () => {
    const a = await guard.getTracker({
      path: '/api/v1/health',
      ip: '10.0.0.9',
      headers: {},
    });
    const b = await guard.getTracker({
      path: '/api/v1/attendance/me',
      ip: '10.0.0.9',
      headers: { authorization: 'Bearer garbage' },
    });
    const other = await guard.getTracker({
      path: '/api/v1/health',
      ip: '10.0.0.10',
      headers: {},
    });
    expect(a).toBe(b);
    expect(a).not.toBe(other);
    expect(a.startsWith('ip-')).toBe(true);
    expect(a).not.toContain('10.0.0.9');
  });
});
