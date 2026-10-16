'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  Cog,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Palmtree,
  ScrollText,
  ShieldCheck,
  Smartphone,
  ArrowLeftRight,
  Users,
  Clock,
  Bell,
  TrendingUp,
} from 'lucide-react';
import { navGroups } from '@/lib/nav';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/dashboard': LayoutDashboard,
  '/admin': TrendingUp,
  '/team': Users,
  '/attendance': ClipboardCheck,
  '/reports': FileBarChart,
  '/employees': Users,
  '/departments': Building2,
  '/shifts': Clock,
  '/schedules': CalendarClock,
  '/devices': Smartphone,
  '/devices/replacements': ArrowLeftRight,
  '/corrections': Bell,
  '/leaves': Palmtree,
  '/audit': ScrollText,
  '/security': ShieldCheck,
  '/settings': Cog,
};

/**
 * True when `href` is the current route, or an ancestor of it.
 *
 * Prefers the longest matching prefix so nested sections do not all highlight
 * at once: on `/devices/replacements` only that row is current, not `/devices`.
 */
export function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // The dashboard must never light up for unrelated routes.
  return href !== '/dashboard';
}

/**
 * Stitch "Web App Shell — Role Hierarchy": a permanent 260px sidebar with the
 * brand block, a live system-status strip, grouped menu sections, and the
 * session block docked to the bottom. Active rows are marked with a 4px
 * primary left border rather than a heavy fill.
 */
/**
 * The single href that should render as current: the longest nav prefix that
 * matches the pathname. Without this, `/devices/replacements` marks both
 * `/devices` and `/devices/replacements` as current.
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (href === pathname) return href;
    if (!isActive(pathname, href)) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}

export function Sidebar({ roles, onLogout }: { roles: string[]; onLogout?: () => void }) {
  const pathname = usePathname();
  const groups = navGroups(roles);
  const current = activeHref(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href)),
  );

  return (
    <>
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col justify-between border-r border-outline-variant/30 bg-surface-container-lowest md:flex">
      <div className="flex flex-col">
        <div className="flex items-center gap-space-sm border-b border-outline-variant/30 px-space-md py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex flex-col">
            <span className="font-headline-md font-bold text-primary">RS Absen</span>
            <span className="text-label-sm text-outline">RSUD Sehat Medika Pusat</span>
          </div>
        </div>

        {groups.some((group) => group.items.some((item) => item.href === '/schedules')) ? (
          <Link
            href="/schedules"
            className="mx-3 mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-surface-container-low px-3 py-2 text-body-md-medium text-primary transition-colors hover:bg-surface-container"
          >
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" aria-hidden />
              Buka Jadwal Jaga
            </span>
            <span aria-hidden>→</span>
          </Link>
        ) : null}

        <nav
          className="mt-4 max-h-[calc(100vh-250px)] flex-1 space-y-4 overflow-y-auto px-2 pb-2"
          aria-label="Navigasi utama"
        >
          {groups.map((group) => (
            <div key={group.title ?? 'ungrouped'}>
              {group.title ? (
                <h2 className="px-space-md py-1 text-label-sm font-semibold uppercase tracking-wider text-outline">
                  {group.title}
                </h2>
              ) : null}
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = ICONS[item.href] ?? LayoutDashboard;
                  const active = current === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center justify-between gap-space-sm rounded-lg px-space-md py-2.5 text-body-md transition-colors duration-150',
                          active
                            ? 'border-l-4 border-primary bg-surface-container-low font-semibold text-primary'
                            : 'border-l-4 border-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
                        )}
                      >
                        <span className="flex items-center gap-space-sm">
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                          {item.label}
                        </span>
                        {item.badge ? (
                          <span
                            className={cn(
                              'tabular rounded px-1.5 py-0.5 text-[10px] font-bold',
                              item.badge === 'Live'
                                ? 'bg-secondary-fixed text-on-secondary-container'
                                : 'bg-error-container text-on-error-container',
                            )}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="space-y-1 border-t border-outline-variant/30 pt-3">
        <div className="px-space-md py-2 text-label-sm text-outline">
          Signing in as{' '}
          <span className="font-medium text-on-surface-variant">{roles.join(', ')}</span>
        </div>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-space-sm rounded-lg px-space-md py-2 text-body-sm text-error transition-colors hover:bg-error-container/20"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
            Keluar dari Sistem
          </button>
        ) : null}
      </div>
    </aside>
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-surface-container-lowest/95 pb-2 pt-1 backdrop-blur md:hidden"
      aria-label="Navigasi utama seluler"
    >
      <ul className="flex gap-1 overflow-x-auto px-2">
        {groups.flatMap((group) => group.items).map((item) => {
          const Icon = ICONS[item.href] ?? LayoutDashboard;
          const active = current === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[10px] leading-tight transition-colors',
                  active ? 'bg-primary/10 font-semibold text-primary' : 'text-on-surface-variant hover:bg-surface-container-low',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="line-clamp-2">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}
