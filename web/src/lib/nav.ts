// STEP 4 — role-based navigation (PRD §28 menu). Pure + unit-tested.
// Visibility here is UX only; enforcement stays server-side (backend guards).

export interface NavItem {
  href: string;
  label: string;
  roles: string[]; // direct grants; hierarchy expands downward
  /** Optional uppercase section heading, per the shell design's menu groups. */
  group?: string;
  /** Small counter chip rendered on the right of the row. */
  badge?: string;
}

const RANK: Record<string, number> = {
  EMPLOYEE: 1,
  SUPERVISOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export const NAV: NavItem[] = [
  // Web hanya untuk SUPERVISOR ke atas — akun EMPLOYEE (karyawan) khusus
  // aplikasi mobile dan ditolak di BFF login + layout (lihat canUseWeb).
  { href: '/dashboard', label: 'Dashboard', roles: ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'] },
  { href: '/admin', label: 'Ringkasan', roles: ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'] },
  { href: '/team', label: 'Tim Saya', roles: ['SUPERVISOR'], group: 'Supervisi' },
  { href: '/attendance', label: 'Rekap Absensi', roles: ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'], group: 'Supervisi', badge: 'Live' },
  { href: '/reports', label: 'Laporan Tim', roles: ['SUPERVISOR'], group: 'Supervisi' },

  { href: '/employees', label: 'Karyawan & Staf', roles: ['ADMIN', 'SUPER_ADMIN'], group: 'Master Data' },
  { href: '/users', label: 'Akun & Peran', roles: ['SUPER_ADMIN'], group: 'Master Data' },
  { href: '/departments', label: 'Departemen', roles: ['ADMIN', 'SUPER_ADMIN'], group: 'Master Data' },
  { href: '/shifts', label: 'Master Shift', roles: ['ADMIN', 'SUPER_ADMIN'], group: 'Master Data' },
  { href: '/schedules', label: 'Roster Jadwal', roles: ['ADMIN', 'SUPER_ADMIN'], group: 'Master Data' },

  { href: '/corrections', label: 'Koreksi Presensi', roles: ['ADMIN', 'SUPER_ADMIN'], group: 'Persetujuan', badge: '3' },
  { href: '/leaves', label: 'Izin & Cuti', roles: ['ADMIN', 'SUPER_ADMIN'], group: 'Persetujuan' },

  { href: '/devices', label: 'Perangkat Terdaftar', roles: ['SUPER_ADMIN'], group: 'Keamanan' },
  { href: '/devices/replacements', label: 'Penggantian Perangkat', roles: ['SUPER_ADMIN'], group: 'Keamanan' },
  { href: '/audit', label: 'Audit Log', roles: ['SUPER_ADMIN'], group: 'Keamanan' },
  { href: '/security', label: 'Konfigurasi Geofence', roles: ['SUPER_ADMIN'], group: 'Keamanan' },
  { href: '/settings', label: 'Pengaturan Sistem', roles: ['SUPER_ADMIN'], group: 'Keamanan' },
];

/** Expand roles downward: max rank N implies every rank <= N. */
export function expandRoles(roles: string[]): string[] {
  const max = Math.max(0, ...roles.map((r) => RANK[r] ?? 0));
  return Object.keys(RANK).filter((r) => RANK[r] <= max);
}

/** Highest role rank held (0 = no recognized role). */
export function highestRank(roles: string[]): number {
  return Math.max(0, ...roles.map((r) => RANK[r] ?? 0));
}

/**
 * Web gate: dashboard web hanya untuk SUPERVISOR ke atas. Akun EMPLOYEE
 * murni (peringkat di bawah SUPERVISOR) khusus aplikasi mobile — BFF login
 * menolak membuat sesi dan layout melempar forbidden() sebagai backstop.
 */
export function canUseWeb(roles: string[]): boolean {
  return highestRank(roles) >= RANK.SUPERVISOR;
}

/** Ambil daftar peran string dari payload `user` backend yang tak terketik. */
export function rolesOf(user: unknown): string[] {
  if (typeof user !== 'object' || user === null) return [];
  const roles = (user as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((r): r is string => typeof r === 'string');
}

export function navFor(roles: string[]): NavItem[] {
  const have = new Set(expandRoles(roles));
  if (have.size === 0) return [];
  return NAV.filter((item) => item.roles.some((r) => have.has(r)));
}

export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

/**
 * Same items as [navFor], but bucketed under their section headings and with
 * empty groups dropped. `null` title means "no heading" (the dashboard sits
 * above the fold on its own).
 */
export function navGroups(roles: string[]): NavGroup[] {
  const items = navFor(roles);
  const groups: NavGroup[] = [];
  let current: NavGroup | null = null;
  for (const item of items) {
    if (!current || current.title !== (item.group ?? null)) {
      current = { title: item.group ?? null, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}
