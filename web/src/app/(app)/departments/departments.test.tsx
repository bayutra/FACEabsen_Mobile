import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartmentCreateForm } from './department-create-form';
import { DepartmentRowActions } from './department-row-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

const hospitals = [{ id: 'h1', code: 'RS-A', name: 'RS Contoh' }];

function ok() {
  return { ok: true, json: async () => ({}) };
}

describe('DepartmentCreateForm', () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it('starts collapsed and opens the form on click', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    render(<DepartmentCreateForm hospitals={hospitals} />);

    expect(screen.getByText('Tambah departemen')).toBeDefined();
    expect(screen.queryByLabelText('Nama departemen')).toBeNull();

    fireEvent.click(screen.getByText('Tambah departemen'));
    expect(screen.getByLabelText('Nama departemen')).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('posts the whitelisted fields and refreshes', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<DepartmentCreateForm hospitals={hospitals} />);

    fireEvent.click(screen.getByText('Tambah departemen'));
    fireEvent.change(screen.getByLabelText('Nama departemen'), { target: { value: 'Radiologi' } });
    fireEvent.click(screen.getByText('Simpan departemen'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/departments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ hospitalId: 'h1', name: 'Radiologi' });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('surfaces the backend message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ message: 'Department name already exists for this hospital' }) })),
    );
    render(<DepartmentCreateForm hospitals={hospitals} />);

    fireEvent.click(screen.getByText('Tambah departemen'));
    fireEvent.change(screen.getByLabelText('Nama departemen'), { target: { value: 'IGD' } });
    fireEvent.click(screen.getByText('Simpan departemen'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('already exists'),
    );
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('disables saving when no facility is provisioned yet', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    render(<DepartmentCreateForm hospitals={[]} />);

    fireEvent.click(screen.getByText('Tambah departemen'));
    expect(screen.getByText('Simpan departemen').hasAttribute('disabled')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('calls the API exactly once on rapid double-submit', async () => {
    let release!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const pending = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => pending);
    vi.stubGlobal('fetch', fetchMock);
    render(<DepartmentCreateForm hospitals={hospitals} />);

    fireEvent.click(screen.getByText('Tambah departemen'));
    fireEvent.change(screen.getByLabelText('Nama departemen'), { target: { value: 'Radiologi' } });

    // Dua submit dalam tick yang sama — state `busy` belum sempat re-render,
    // jadi guard ref yang menahan submit kedua.
    const form = screen.getByLabelText('Nama departemen').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(ok());
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('moves focus into the form on open and back to the trigger on cancel', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    render(<DepartmentCreateForm hospitals={hospitals} />);

    fireEvent.click(screen.getByText('Tambah departemen'));
    expect(document.activeElement).toBe(screen.getByLabelText('Fasilitas'));

    fireEvent.click(screen.getByText('Batal'));
    expect(document.activeElement?.textContent).toContain('Tambah departemen');
    vi.unstubAllGlobals();
  });
});

describe('DepartmentRowActions', () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.restoreAllMocks();
  });

  it('patches the name then refreshes', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<DepartmentRowActions id="d1" name="IGD" />);

    fireEvent.click(screen.getByText('Ubah'));
    fireEvent.change(screen.getByLabelText('Nama baru'), { target: { value: 'Instalasi Gawat Darurat' } });
    fireEvent.click(screen.getByText('Simpan'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/departments/d1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Instalasi Gawat Darurat' });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('deletes after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<DepartmentRowActions id="d1" name="IGD" />);

    fireEvent.click(screen.getByText('Hapus'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/departments/d1');
    expect(init.method).toBe('DELETE');
    vi.unstubAllGlobals();
  });

  it('does not call the API when the confirm dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<DepartmentRowActions id="d1" name="IGD" />);

    fireEvent.click(screen.getByText('Hapus'));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('explains the refusal when staff are still assigned', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Department still has 3 employee assigned; move them first' }),
      })),
    );
    render(<DepartmentRowActions id="d1" name="IGD" />);

    fireEvent.click(screen.getByText('Hapus'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('still has 3 employee'),
    );
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('joins array validation messages from the API', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: ['name must be longer than or equal to 2', 'other'] }),
      })),
    );
    render(<DepartmentRowActions id="d1" name="IGD" />);

    fireEvent.click(screen.getByText('Hapus'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('name must be longer'),
    );
    vi.unstubAllGlobals();
  });
});