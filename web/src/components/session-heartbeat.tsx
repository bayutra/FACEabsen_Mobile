'use client';

import { useEffect } from 'react';

// Keeps the 15-minute access cookie alive while the tab is open. The BFF
// refresh route rotates the httpOnly cookies server-side; this component just
// triggers it ahead of expiry (13 min) and when the tab becomes visible again
// after being idle. Failures are silent — the next server navigation will
// redirect to /login if the refresh token is truly dead.
const REFRESH_AHEAD_MS = 13 * 60 * 1000;

export function SessionHeartbeat() {
  useEffect(() => {
    const timer: ReturnType<typeof setInterval> = setInterval(() => void ping(), REFRESH_AHEAD_MS);
    let stopped = false;

    async function ping() {
      try {
        await fetch('/api/auth/refresh', { method: 'POST' });
      } catch {
        // Network down — retry on the next tick / visibility change.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible' && !stopped) void ping();
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
