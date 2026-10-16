import { describe, expect, it } from 'vitest';
import { activeHref, isActive } from './sidebar';

const HREFS = ['/dashboard', '/team', '/devices', '/devices/replacements', '/employees'];

describe('isActive', () => {
  it('matches the exact route', () => {
    expect(isActive('/devices', '/devices')).toBe(true);
  });

  it('matches a nested route', () => {
    expect(isActive('/devices/abc', '/devices')).toBe(true);
  });

  it('does not match a sibling that merely shares a prefix', () => {
    // "/devices-archive" starts with "/devices" as a string but is a different
    // section; the slash boundary is what stops that false match.
    expect(isActive('/devices-archive', '/devices')).toBe(false);
  });

  it('never lights the dashboard for unrelated routes', () => {
    expect(isActive('/employees', '/dashboard')).toBe(false);
    expect(isActive('/dashboard', '/dashboard')).toBe(true);
  });
});

describe('activeHref', () => {
  it('returns the exact route when present', () => {
    expect(activeHref('/devices', HREFS)).toBe('/devices');
  });

  it('prefers the deepest match so only one row highlights', () => {
    expect(activeHref('/devices/replacements', HREFS)).toBe('/devices/replacements');
  });

  it('falls back to an ancestor section for an unknown leaf', () => {
    expect(activeHref('/devices/unknown-id', HREFS)).toBe('/devices');
  });

  it('returns null when nothing matches', () => {
    expect(activeHref('/nowhere', HREFS)).toBeNull();
  });
});
