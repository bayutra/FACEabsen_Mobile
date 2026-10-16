import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserCreateForm } from './user-create-form';
import { UserRowActions } from './user-row-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

function ok() {
  return { ok: true, status: 200, json: async () => ({}) };
}

describe('UserCreateForm', () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it('defaults to EMPLOYEE and posts email + password + roles', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<UserCreateForm canGrantSuperAdmin={false} />);

    fireEvent.click(screen.getByText('Tambah akun'));
    expect(screen.getByText('Role Karyawan selalu ditambahkan otomatis oleh sistem.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' it@rs.test ' } });
    fireEvent.change(screen.getByLabelText('Password sementara'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByText('Supervisor'));
    fireEvent.click(screen.getByText('Simpan akun'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/users');
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe('it@rs.test');
    expect(body.password).toBe('Password123!');
    expect(body.roles).toEqual(['EMPLOYEE', 'SUPERVISOR']);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('hides SUPER_ADMIN from non-SUPER_ADMIN actors', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const { unmount } = render(<UserCreateForm canGrantSuperAdmin={false} />);
    fireEvent.click(screen.getByText('Tambah akun'));
    expect(screen.queryByText('Super Admin')).toBeNull();
    unmount();

    render(<UserCreateForm canGrantSuperAdmin />);
    fireEvent.click(screen.getByText('Tambah akun'));
    expect(screen.getByText('Super Admin')).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('surfaces the backend refusal verbatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Not allowed to grant role ADMIN' }),
      })),
    );
    render(<UserCreateForm canGrantSuperAdmin={false} />);

    fireEvent.click(screen.getByText('Tambah akun'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@rs.test' } });
    fireEvent.change(screen.getByLabelText('Password sementara'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByText('Admin'));
    fireEvent.click(screen.getByText('Simpan akun'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Not allowed to grant role ADMIN'),
    );
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('refuses to submit with every role unchecked', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    render(<UserCreateForm canGrantSuperAdmin={false} />);

    fireEvent.click(screen.getByText('Tambah akun'));
    fireEvent.click(screen.getByText('Karyawan'));
    expect(screen.getByText('Simpan akun').hasAttribute('disabled')).toBe(true);
    vi.unstubAllGlobals();
  });
});

const rowProps = {
  id: 'u1',
  roles: ['EMPLOYEE'],
  isActive: true,
  lockedUntil: null,
  isSelf: false,
  canGrantSuperAdmin: false,
};

describe('UserRowActions', () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.restoreAllMocks();
  });

  it('patches new roles', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<UserRowActions {...rowProps} />);

    fireEvent.click(screen.getByText('Ubah role'));
    fireEvent.click(screen.getByText('Supervisor'));
    fireEvent.click(screen.getByText('Simpan role'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/users/u1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ roles: ['EMPLOYEE', 'SUPERVISOR'] });
    vi.unstubAllGlobals();
  });

  it('toggles activation', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<UserRowActions {...rowProps} />);

    fireEvent.click(screen.getByText('Nonaktifkan'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ isActive: false });
    vi.unstubAllGlobals();
  });

  it('calls the API exactly once on rapid double activation', async () => {
    let release!: (value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    const pending = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>(
      (resolve) => {
        release = resolve;
      },
    );
    const fetchMock = vi.fn(async () => pending);
    vi.stubGlobal('fetch', fetchMock);
    render(<UserRowActions {...rowProps} />);

    // Dua klik dalam tick yang sama — state `busy` belum sempat re-render,
    // jadi guard ref yang menahan aktivasi kedua.
    fireEvent.click(screen.getByText('Nonaktifkan'));
    fireEvent.click(screen.getByText('Nonaktifkan'));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(ok());
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('resets the password on the dedicated endpoint', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<UserRowActions {...rowProps} />);

    fireEvent.click(screen.getByText('Reset password'));
    fireEvent.change(screen.getByLabelText('Password baru'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/users/u1/reset-password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ password: 'Password123!' });
    vi.unstubAllGlobals();
  });

  it('disables self role edit and self deactivation', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    render(<UserRowActions {...rowProps} isSelf />);

    expect(screen.getByText('Ubah role').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Nonaktifkan').hasAttribute('disabled')).toBe(true);
    // Resetting your own password is still allowed.
    expect(screen.getByText('Reset password').hasAttribute('disabled')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('surfaces the rank-guard refusal from the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Cannot administer an account at or above your own rank' }),
      })),
    );
    render(<UserRowActions {...rowProps} />);

    fireEvent.click(screen.getByText('Nonaktifkan'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('at or above your own rank'),
    );
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('keeps the draft role selection after a failed save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ message: 'email bentrok' }) })),
    );
    render(<UserRowActions {...rowProps} />);

    fireEvent.click(screen.getByText('Ubah role'));
    fireEvent.click(screen.getByText('Supervisor'));
    fireEvent.click(screen.getByText('Simpan role'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('email bentrok'));
    // Editor stays open with the operator's choice intact.
    expect(screen.getByText('Simpan role')).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('flags inactive and locked accounts', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const { unmount } = render(<UserRowActions {...rowProps} isActive={false} />);
    expect(screen.getByText('Nonaktif')).toBeDefined();
    unmount();

    render(
      <UserRowActions
        {...rowProps}
        lockedUntil={new Date(Date.now() + 60_000).toISOString()}
      />,
    );
    expect(screen.getByText('Terkunci')).toBeDefined();
    vi.unstubAllGlobals();
  });
});