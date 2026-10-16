import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}));

// STEP 23 — sidebar renders the role-filtered menu (UI + RBAC).
describe('Sidebar role menu', () => {
  it('ADMIN sees management, not super-only items', () => {
    render(<Sidebar roles={['ADMIN']} />);
    expect(screen.getAllByText('Karyawan & Staf')).toHaveLength(2);
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
    expect(screen.queryByText('Akun & Peran')).not.toBeInTheDocument();
    expect(screen.queryByText('Perangkat Terdaftar')).not.toBeInTheDocument();
    expect(screen.queryByText('Penggantian Perangkat')).not.toBeInTheDocument();
    expect(screen.queryByText('Konfigurasi Geofence')).not.toBeInTheDocument();
    expect(screen.queryByText('Pengaturan Sistem')).not.toBeInTheDocument();
  });

  it('SUPER_ADMIN sees everything', () => {
    render(<Sidebar roles={['SUPER_ADMIN']} />);
    expect(screen.getAllByText('Konfigurasi Geofence')).toHaveLength(2);
    expect(screen.getAllByText('Pengaturan Sistem')).toHaveLength(2);
    expect(screen.getAllByText('Audit Log')).toHaveLength(2);
    expect(screen.getAllByText('Akun & Peran')).toHaveLength(2);
  });

  it('SUPERVISOR sees team items, not employee admin', () => {
    render(<Sidebar roles={['SUPERVISOR']} />);
    expect(screen.getAllByText('Tim Saya')).toHaveLength(2);
    expect(screen.queryByText('Karyawan & Staf')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
  });

  it('groups the menu under its section headings', () => {
    render(<Sidebar roles={['SUPER_ADMIN']} />);
    for (const heading of ['Master Data', 'Persetujuan', 'Keamanan']) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it('marks the active route', () => {
    render(<Sidebar roles={['ADMIN']} />);
    const currentLinks = screen.getAllByRole('link', { current: 'page' });
    expect(currentLinks).toHaveLength(2);
    currentLinks.forEach((link) => expect(link).toHaveTextContent('Dashboard'));
  });

  it('marks exactly one link current on a nested route', async () => {
    const { usePathname } = await import('next/navigation');
    vi.mocked(usePathname).mockReturnValue('/devices/replacements');
    render(<Sidebar roles={['SUPER_ADMIN']} />);
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(2);
    current.forEach((link) => expect(link).toHaveTextContent('Penggantian Perangkat'));
    vi.mocked(usePathname).mockReturnValue('/dashboard');
  });

  it('shows the logout entry only when a handler is supplied', () => {
    const { unmount } = render(<Sidebar roles={['ADMIN']} />);
    expect(screen.queryByText('Keluar dari Sistem')).not.toBeInTheDocument();
    unmount();

    render(<Sidebar roles={['ADMIN']} onLogout={() => {}} />);
    expect(screen.getByText('Keluar dari Sistem')).toBeInTheDocument();
  });
});
