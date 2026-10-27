'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { isAdmin, isSuperAdmin, type SessionUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, roleLabel } from '@/lib/format';

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  visible: (user: SessionUser) => boolean;
};

type NavSection = { title: string; items: NavItem[] };

const supervisor = (user: SessionUser) => user.roles.includes('SUPERVISOR') || isAdmin(user.roles);
const admin = (user: SessionUser) => isAdmin(user.roles);
const superAdmin = (user: SessionUser) => isSuperAdmin(user.roles);

const NAV: NavSection[] = [
  {
    title: 'Monitoring',
    items: [
      { href: '/', label: 'Ringkasan', icon: 'dashboard', visible: () => true },
      { href: '/attendance', label: 'Tinjauan Presensi', icon: 'checkCircle', visible: supervisor },
      { href: '/corrections', label: 'Koreksi Presensi', icon: 'pen', visible: supervisor },
      { href: '/leaves', label: 'Cuti & Izin', icon: 'calendar', visible: supervisor },
      { href: '/team', label: 'Tim', icon: 'users', visible: supervisor },
    ],
  },
  {
    title: 'Kepegawaian',
    items: [
      { href: '/employees', label: 'Karyawan', icon: 'users', visible: supervisor },
      { href: '/departments', label: 'Unit Kerja', icon: 'building', visible: admin },
      { href: '/shifts', label: 'Shift', icon: 'clock', visible: admin },
      { href: '/schedules', label: 'Jadwal', icon: 'table', visible: admin },
    ],
  },
  {
    title: 'Operasional',
    items: [
      { href: '/devices', label: 'Perangkat', icon: 'device', visible: superAdmin },
      { href: '/device-change', label: 'Penggantian Perangkat', icon: 'swap', visible: superAdmin },
      { href: '/reports', label: 'Laporan', icon: 'fileText', visible: supervisor },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { href: '/users', label: 'Pengguna & Peran', icon: 'settings', visible: superAdmin },
      { href: '/audit', label: 'Audit Log', icon: 'list', visible: superAdmin },
      { href: '/privacy', label: 'Privasi & Retensi', icon: 'shield', visible: superAdmin },
    ],
  },
];

function activeItem(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsOf(email: string): string {
  const base = email.split('@')[0] ?? '';
  const parts = base.split(/[._-]+/).filter(Boolean);
  const letters = (parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2)).toUpperCase();
  return letters || 'FA';
}

export function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const sections = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.visible(user)),
  })).filter((section) => section.items.length > 0);

  const current = sections
    .flatMap((section) => section.items)
    .find((item) => activeItem(pathname, item.href));

  const signOut = async () => {
    setBusy(true);
    await logout();
    router.replace('/login');
    setBusy(false);
  };

  const roleText = user.roles.map(roleLabel).join(' · ');

  return (
    <div className="shell">
      {open ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navigasi utama">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <Icon name="building" size={22} />
            </div>
            <div>
              <strong>Face Absen</strong>
              <span>RSU Darmayu Madiun</span>
            </div>
          </div>

          <nav>
            {sections.map((section) => (
              <div className="nav-section" key={section.title}>
                <span className="nav-title">{section.title}</span>
                {section.items.map((item) => {
                  const isActive = activeItem(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={isActive ? 'nav-link active' : 'nav-link'}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="nav-icon">
                        <Icon name={item.icon} size={19} />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar" aria-hidden>
              {initialsOf(user.email)}
            </span>
            <div className="sidebar-user-text">
              <strong title={user.email}>{user.email}</strong>
              <span>{roleText}</span>
            </div>
          </div>
          <button type="button" className="sidebar-signout" onClick={signOut} disabled={busy}>
            <Icon name="logout" size={17} />
            {busy ? 'Keluar…' : 'Keluar'}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label="Buka menu navigasi"
            >
              <Icon name="menu" size={18} />
              Menu
            </button>
            <div className="crumbs">
              <span className="crumb-base">RSU Darmayu Madiun</span>
              <span className="crumb-base" aria-hidden>
                /
              </span>
              <strong>{current?.label ?? 'Dashboard'}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <span className="chip date-chip">
              <Icon name="calendar" size={15} />
              {formatDate(new Date().toISOString())}
            </span>
            <span className="chip plain">
              <span className="chip-dot" aria-hidden />
              {roleText}
            </span>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
