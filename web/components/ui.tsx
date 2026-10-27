'use client';

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { statusLabel } from '@/lib/format';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? (
          <div className="eyebrow">
            <span>Administrasi RSU</span>
            <span className="sep" aria-hidden>
              /
            </span>
            <strong>{eyebrow}</strong>
          </div>
        ) : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
  footer,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'warn' | 'danger' | 'success';
  icon?: IconName;
  footer?: ReactNode;
}) {
  return (
    <div className={`stat-card ${tone ?? 'default'}`}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {icon ? (
          <span className="stat-icon" aria-hidden>
            <Icon name={icon} size={17} />
          </span>
        ) : null}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
      {footer ? <div className="stat-foot">{footer}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: unknown }) {
  const key = String(status ?? '').toUpperCase();
  return (
    <span className={`badge badge-${key.toLowerCase() || 'unknown'}`}>
      {statusLabel(status)}
    </span>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = 'Belum ada data.',
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty-state" role="status">
        <Icon name="list" size={26} />
        <strong>Tidak ada data</strong>
        <span>{empty}</span>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  const output: (number | 'gap')[] = [];
  sorted.forEach((item, index) => {
    if (index > 0 && item - (sorted[index - 1] as number) > 1) output.push('gap');
    output.push(item);
  });
  return output;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems?: number;
  onChange: (page: number) => void;
}) {
  const safeTotal = Math.max(totalPages, 1);
  return (
    <div className="pagination">
      <span>
        Halaman {page} dari {safeTotal}
        {typeof totalItems === 'number' ? ` · ${totalItems} data` : ''}
      </span>
      <div className="pager">
        <button
          type="button"
          className="pager-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          ‹
        </button>
        {pageWindow(page, safeTotal).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="pager-gap" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className="pager-btn"
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="pager-btn"
          disabled={page >= safeTotal}
          onClick={() => onChange(page + 1)}
          aria-label="Halaman berikutnya"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={`input ${className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={`input ${className ?? ''}`}>
      {children}
    </select>
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={`input ${className ?? ''}`} />;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert error" role="alert">
      <Icon name="alert" size={17} />
      <span>{message}</span>
    </div>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="alert info">
      <Icon name="info" size={17} />
      <span>{children}</span>
    </div>
  );
}

export function Loading({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      {label}
    </div>
  );
}

export function EmptyInline({ children }: { children: ReactNode }) {
  return <div className="empty-inline">{children}</div>;
}
