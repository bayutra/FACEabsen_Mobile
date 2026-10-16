import { describe, expect, it } from 'vitest';
import { toTeamQueryString } from './team';

describe('toTeamQueryString', () => {
  it('drops empties', () => {
    expect(toTeamQueryString({})).toBe('');
    expect(toTeamQueryString({ from: '2026-10-01', to: '2026-10-05' })).toBe(
      '?from=2026-10-01&to=2026-10-05',
    );
  });
});
