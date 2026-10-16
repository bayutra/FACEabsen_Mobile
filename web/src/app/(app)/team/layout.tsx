import { TeamTabs } from './team-tabs';

/**
 * Supervisor section shell. The page title is rendered here so the tab strip
 * stays directly beneath it on every sub-route, and each page renders only its
 * own content below.
 */
export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Supervisi
            <span className="text-primary">/ Tim Saya</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Pengawasan Tim</h1>
          <p className="text-body-sm text-outline">
            Kehadiran, koreksi, izin, dan laporan untuk unit yang Anda awasi.
          </p>
        </div>
        <TeamTabs />
      </div>
      {children}
    </div>
  );
}
