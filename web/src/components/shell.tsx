'use client';

import { Header } from '@/components/header';
import { SessionHeartbeat } from '@/components/session-heartbeat';
import { Sidebar } from '@/components/sidebar';
import type { SessionUser } from '@/lib/api';

/**
 * Stitch shell geometry: a permanent 260px sidebar, a fixed 64px header offset
 * by that sidebar, and a content column capped at 1400px so wide monitors do not
 * stretch table rows past readability.
 */
export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface text-on-surface">
      <SessionHeartbeat />
      <Sidebar roles={user.roles} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 px-margin pb-24 pt-space-lg md:px-margin-tablet md:pb-space-xl md:pt-space-xl lg:px-margin-desktop">
          <div className="mx-auto max-w-[1400px] space-y-space-xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
