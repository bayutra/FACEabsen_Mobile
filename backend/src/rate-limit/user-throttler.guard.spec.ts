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
  it('keys login by account email (NAT-proof), case-insensitive', async () => {
    const a = await guard.getTracker({
      path: '/api/v1/auth/login',
      body: { email: 'Nurse@Rs.Test' },
    });
    const b = await guard.getTracker({
      path: '/api/v1/auth/login',
      body: { email: 'nurse@rs.test' },
    });
    expect(a).toBe('auth-email:nurse@rs.test');
    expect(a).toBe(b);
  });

  it('keys refresh by token prefix', async () => {
    const a = await guard.getTracker({
      path: '/api/v1/auth/refresh',
      body: { refreshToken: 'abcdefghijklmnop' },
    });
    const b = await guard.getTracker({
      path: '/api/v1/auth/refresh',
      body: { refreshToken: 'abcdefghijklmnop' },
    });
    expect(a).toBe(b);
    expect(a.startsWith('auth-refresh:')).toBe(true);
    const c = await guard.getTracker({
      path: '/api/v1/auth/refresh',
      body: { refreshToken: 'zzzzzzzzzzzzzzzz' },
    });
    expect(c).not.toBe(a);
  });

  it('keys authenticated requests per JWT sub without verifying', async () => {
    const a = await guard.getTracker({
      path: '/api/v1/attendance/check-in',
      headers: { authorization: `Bearer ${jwt('u1')}` },
    });
    expect(a).toBe('user-u1');

    const forged = await guard.getTracker({
      path: '/api/v1/attendance/check-in',
      headers: { authorization: `Bearer ${jwt('attacker')}` },
    });
    expect(forged).toBe('user-attacker');
  });

  it('falls back to IP with no usable identity', async () => {
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
    expect(typeof a).toBe('string');
    expect(a).toContain('10.0.0.9');
    expect(typeof b).toBe('string');
  });
});
