'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/team', label: 'Monitoring' },
  { href: '/team/attendance', label: 'Absensi' },
  { href: '/team/corrections', label: 'Koreksi' },
  { href: '/team/leaves', label: 'Izin & Cuti' },
  { href: '/team/reports', label: 'Laporan' },
];

// STEP 17 — sub-navigation for the supervisor section.
export function TeamTabs() {
  const pathname = usePathname();
  return (
    // DESIGN.md segmented control: white track, primary fill on the active tab.
    <nav
      aria-label="Navigasi tim"
      className="inline-flex flex-wrap gap-0.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-0.5"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-label-md transition-colors',
              active
                ? 'bg-primary font-semibold text-on-primary shadow-surface-1'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
