'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Building2, LogOut, Search } from 'lucide-react';
import { BackendStatus } from '@/components/backend-status';
import { Button } from '@/components/ui/button';
import type { SessionUser } from '@/lib/api';

export function Header({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-outline-variant/40 bg-surface-container-lowest/95 px-space-md py-2 shadow-surface-1 backdrop-blur md:px-space-lg">
      <div className="flex min-w-0 flex-1 items-center gap-space-md">
        <div className="flex shrink-0 items-center gap-2 text-primary">
          <Building2 className="h-5 w-5" aria-hidden />
          <span className="hidden text-body-md-medium sm:inline">RSU Darmayu Madiun</span>
        </div>
        <form action="/attendance" className="relative hidden min-w-0 max-w-lg flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden />
          <input
            type="search"
            name="search"
            placeholder="Cari staf berdasarkan nama atau NIP"
            aria-label="Cari staf berdasarkan nama atau NIP"
            className="h-10 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline transition-colors hover:bg-surface-container-lowest focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>
      </div>

      <div className="flex shrink-0 items-center gap-space-sm md:gap-space-md">
        <div className="hidden sm:block">
          <BackendStatus />
        </div>
        <div className="hidden min-w-0 items-center gap-2 border-l border-outline-variant/40 pl-space-md sm:flex">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-label-md font-bold text-on-primary-fixed">
            {initials}
          </span>
          <span className="hidden max-w-40 truncate text-body-sm text-on-surface-variant xl:block">
            {user.email}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} disabled={busy}>
          <LogOut className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Keluar</span>
          <span className="sr-only sm:hidden">Keluar dari sistem</span>
        </Button>
      </div>
    </header>
  );
}