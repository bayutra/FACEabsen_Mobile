import { describe, expect, it } from 'vitest';
import { toEmployeeQueryString } from './employees';

describe('toEmployeeQueryString', () => {
  it('drops defaults and empties', () => {
    expect(toEmployeeQueryString({})).toBe('');
    expect(toEmployeeQueryString({ page: 1, pageSize: 20, status: '', search: '  ' })).toBe('');
  });

  it('serializes real filters', () => {
    expect(toEmployeeQueryString({ page: 2, search: 'siti' })).toBe('?page=2&search=siti');
    expect(toEmployeeQueryString({ status: 'ACTIVE', pageSize: 50 })).toBe(
      '?pageSize=50&status=ACTIVE',
    );
  });
});
