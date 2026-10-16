import { describe, expect, it } from 'vitest';
import { toAuditQueryString } from './audit';

describe('toAuditQueryString', () => {
  it('drops empties; encodes security preset', () => {
    expect(toAuditQueryString({})).toBe('');
    expect(toAuditQueryString({ action: 'LOGIN_FAILED', security: true })).toBe(
      '?action=LOGIN_FAILED&security=true',
    );
  });
});
