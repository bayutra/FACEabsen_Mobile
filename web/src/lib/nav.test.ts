import { describe, expect, it } from 'vitest';
import { canUseWeb, expandRoles, highestRank, navFor, navGroups, rolesOf } from './nav';

describe('navFor (role-based menu)', () => {
  it('SUPER_ADMIN sees everything', () => {
    const hrefs = navFor(['SUPER_ADMIN']).map((i) => i.href);
    for (const h of ['/dashboard', '/employees', '/audit', '/security', '/settings', '/team', '/reports']) {
      expect(hrefs).toContain(h);
    }
  });

  it('navGroups buckets items under headings without losing any', () => {
    const roles = ['SUPER_ADMIN'];
    const groups = navGroups(roles);
    const flat = groups.flatMap((g) => g.items.map((i) => i.href));
    expect(flat).toEqual(navFor(roles).map((i) => i.href));
    // The dashboard sits above the sections with no heading of its own.
    expect(groups[0].title).toBeNull();
    expect(groups.slice(1).every((g) => g.title !== null)).toBe(true);
  });

  it('navGroups drops sections a role cannot see', () => {
    const groups = navGroups(['SUPERVISOR']);
    expect(groups.map((g) => g.title)).not.toContain('Master Data');
    expect(groups.flatMap((g) => g.items).map((i) => i.href)).toContain('/team');
  });

  it('ADMIN sees management but not super-only items', () => {
    const hrefs = navFor(['ADMIN']).map((i) => i.href);
    expect(hrefs).toContain('/employees');
    expect(hrefs).not.toContain('/audit');
    expect(hrefs).not.toContain('/users');
    expect(hrefs).not.toContain('/devices');
    expect(hrefs).not.toContain('/devices/replacements');
    expect(hrefs).not.toContain('/security');
    expect(hrefs).not.toContain('/settings');
  });

  it('SUPERVISOR sees team + reports but not employee admin or audit', () => {
    const hrefs = navFor(['SUPERVISOR']).map((i) => i.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/team');
    expect(hrefs).toContain('/reports');
    expect(hrefs).not.toContain('/employees');
    expect(hrefs).not.toContain('/audit');
    expect(hrefs).not.toContain('/security');
  });

  it('SUPER_ADMIN alone manages accounts, devices, and reads the audit log', () => {
    const hrefs = navFor(['SUPER_ADMIN']).map((i) => i.href);
    expect(hrefs).toContain('/users');
    expect(hrefs).toContain('/audit');
    expect(hrefs).toContain('/devices');
    expect(hrefs).toContain('/devices/replacements');
  });

  it('EMPLOYEE sees nothing on web (mobile-only account)', () => {
    expect(navFor(['EMPLOYEE'])).toEqual([]);
    expect(navFor([])).toEqual([]);
    expect(navFor(['GHOST'])).toEqual([]);
  });

  it('hierarchy expands downward', () => {
    expect(expandRoles(['ADMIN'])).toEqual(expect.arrayContaining(['EMPLOYEE', 'SUPERVISOR', 'ADMIN']));
    expect(expandRoles(['ADMIN'])).not.toContain('SUPER_ADMIN');
  });

  it('canUseWeb allows SUPERVISOR and above only', () => {
    expect(canUseWeb(['EMPLOYEE'])).toBe(false);
    expect(canUseWeb([])).toBe(false);
    expect(canUseWeb(['GHOST'])).toBe(false);
    expect(canUseWeb(['EMPLOYEE', 'SUPERVISOR'])).toBe(true);
    expect(canUseWeb(['ADMIN'])).toBe(true);
    expect(canUseWeb(['SUPER_ADMIN'])).toBe(true);
    expect(highestRank(['EMPLOYEE'])).toBe(1);
    expect(highestRank([])).toBe(0);
  });

  it('rolesOf extracts string roles defensively', () => {
    expect(rolesOf({ roles: ['ADMIN', 42, null] })).toEqual(['ADMIN']);
    expect(rolesOf({})).toEqual([]);
    expect(rolesOf(null)).toEqual([]);
    expect(rolesOf('ADMIN')).toEqual([]);
  });
});
