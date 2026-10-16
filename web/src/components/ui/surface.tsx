import type { ReactNode } from 'react';

/**
 * Stitch data-table primitives from the "Clinical Attendance & Operations"
 * export. Every timestamp cell uses `tabular-data` so times and NIKs line up
 * vertically down a roster column.
 */

/** DESIGN.md: header #F8FAFC, uppercase `label-md`, hairline bottom border. */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-surface-1">
      {children}
    </div>
  );
}

export function Th({
  children,
  className = '',
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-label-md uppercase tracking-wider text-on-surface-variant ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

/** DESIGN.md: 52px standard row, hairline separator, hover to canvas. */
export function Tr({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={`h-[52px] border-b border-outline-variant/30 last:border-0 hover:bg-surface ${className}`}>
      {children}
    </tr>
  );
}

export function Td({
  children,
  className = '',
  tabular: isTabular,
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  /** Renders with tabular figures — use for times, counts and NIKs. */
  tabular?: boolean;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className={`px-4 py-3 text-body-md ${isTabular ? 'tabular' : ''} ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}

/** DESIGN.md inputs: 40px tall, white, 8px radius, primary focus border. */
export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-label-md text-on-surface">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface ' +
  'placeholder:text-outline transition-colors hover:bg-surface ' +
  'focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20';

/** DESIGN.md badges: 8px vertical padding, solid 1px border, 6px radius. */
export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}) {
  const tones: Record<string, string> = {
    success: 'bg-success-bg text-success-fg border-success-border',
    warning: 'bg-warning-bg text-warning-fg border-warning-border',
    danger: 'bg-danger-bg text-danger-fg border-danger-border',
    info: 'bg-info-bg text-info-fg border-info-border',
    neutral: 'bg-surface-container-low text-on-surface-variant border-outline-variant/40',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-2 text-label-md ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Filter bar wrapper: the search/select row above every roster table. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-space-sm rounded-lg border border-outline-variant bg-surface-container-low p-space-md"
    >
      {children}
    </form>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-body-sm text-outline">
        {children}
      </td>
    </tr>
  );
}
