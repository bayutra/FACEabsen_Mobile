import type { SVGProps } from 'react';

/**
 * Local icon set.
 *
 * The design reference uses Material Symbols, which would require a second
 * webfont request. These glyphs are drawn on the same 24px grid with a
 * consistent 1.75px stroke so the dashboard stays self-hosted and predictable.
 */
export type IconName =
  | 'activity'
  | 'alert'
  | 'arrowRight'
  | 'arrowUp'
  | 'bell'
  | 'building'
  | 'calendar'
  | 'checkCircle'
  | 'chevronRight'
  | 'clock'
  | 'close'
  | 'dashboard'
  | 'device'
  | 'download'
  | 'eye'
  | 'eyeOff'
  | 'fileText'
  | 'heatmap'
  | 'info'
  | 'key'
  | 'list'
  | 'lock'
  | 'logout'
  | 'menu'
  | 'pen'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'shield'
  | 'swap'
  | 'table'
  | 'users';

const PATHS: Record<IconName, React.ReactNode> = {
  activity: <path d="M3 12h4l2.5-6 4.5 12 2.5-6H21" />,
  alert: (
    <>
      <path d="M12 3.5 2.8 20h18.4Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.2h.01" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h14" />
      <path d="m13 7 5 5-5 5" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19V6" />
      <path d="m7 11 5-5 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5.5-2 6.8-2 6.8h16s-2-1.3-2-6.8Z" />
      <path d="M10.2 19a2 2 0 0 0 3.6 0" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M9 8h1.6M13.4 8H15M9 12h1.6M13.4 12H15" />
      <path d="M10 20.5v-3.8h4v3.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3v3.5M16 3v3.5M3.5 10.5h17" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="m8.4 12.2 2.4 2.4 4.8-5.1" />
    </>
  ),
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7.2V12l3.4 2" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  device: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 19.5h16" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4.5 20 20" />
      <path d="M9.6 5.9A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.9" />
      <path d="M6.4 7.6A17.5 17.5 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3.7-.74" />
    </>
  ),
  fileText: (
    <>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z" />
      <path d="M14 3.5v5h5" />
      <path d="M9 13h6M9 16.5h6" />
    </>
  ),
  heatmap: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 11v5.2" />
      <path d="M12 7.8h.01" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4" />
      <path d="m10.9 12.6 8.6-8.6" />
      <path d="m16 6.5 2 2M14 8.5l2 2" />
    </>
  ),
  list: (
    <>
      <path d="M8.5 6h11.5M8.5 12h11.5M8.5 18h11.5" />
      <path d="M4.3 6h.01M4.3 12h.01M4.3 18h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14.3v2.2" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h3.5" />
      <path d="M16 16.5l4.5-4.5L16 7.5" />
      <path d="M20.5 12H9.5" />
    </>
  ),
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  pen: (
    <>
      <path d="M4 20h4L19.2 8.8a2.2 2.2 0 0 0-3.1-3.1L5 16.9Z" />
      <path d="m14.6 7.2 3.1 3.1" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.8-6.3" />
      <path d="M20.8 4.2v5h-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.2 14.6a1.7 1.7 0 0 0 .35 1.9l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.9-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.4a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.9.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.9 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.4a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.9l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.9.34H9.4a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.4a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.9v.08a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.4a1.7 1.7 0 0 0-1.4.9Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v6.2c0 4.3 3.1 7.9 7.5 8.8 4.4-.9 7.5-4.5 7.5-8.8V6Z" />
      <path d="m9 12.1 2.1 2.1 4-4.3" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8.5h13.5" />
      <path d="m14 5 3.5 3.5L14 12" />
      <path d="M20 15.5H6.5" />
      <path d="M10 12l-3.5 3.5L10 19" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M3.5 14.8h17M9.5 10v9.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.6" />
      <path d="M3.2 20v-.8A4.9 4.9 0 0 1 8.1 14.3h2.8a4.9 4.9 0 0 1 4.9 4.9v.8" />
      <path d="M16.6 4.9a3.6 3.6 0 0 1 0 6.8" />
      <path d="M17.7 14.6a4.9 4.9 0 0 1 3.1 4.5v.9" />
    </>
  ),
};

const FILLED: IconName[] = ['checkCircle'];

export function Icon({
  name,
  size = 20,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const filled = FILLED.includes(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {filled ? (
        <g fill="currentColor" stroke="none">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.1 12.2 2.5 2.5 5-5.4" stroke="#fff" strokeWidth={1.9} fill="none" />
        </g>
      ) : (
        PATHS[name]
      )}
    </svg>
  );
}
