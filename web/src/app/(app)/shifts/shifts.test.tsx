import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftCreateForm } from './shift-create-form';
import { ShiftRowActions } from './shift-row-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

const hospitals = [{ id: 'h1', code: 'RS-A', name: 'RS Contoh' }];

const shiftProps = {
  id: 's1',
  name: 'PAGI',
  startTime: '07:00',
  endTime: '15:00',
  gracePeriodMin: 15,
  lateThresholdMin: 30,
  earlyCheckoutThresholdMin: 15,
};

function ok() {
  return { ok: true, json: async () => ({}) };
}

describe('ShiftCreateForm', () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it('opens a form prefilled with a sane day window', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    render(<ShiftCreateForm hospitals={hospitals} />);

    fireEvent.click(screen.getByText('Tambah shift'));
    expect((screen.getByLabelText('Mulai') as HTMLInputElement).value).toBe('07:00');
    expect((screen.getByLabelText('Selesai') as HTMLInputElement).value).toBe('15:00');
    vi.unstubAllGlobals();
  });

  it('posts the form without an overnight field (backend derives it)', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<ShiftCreateForm hospitals={hospitals} />);

    fireEvent.click(screen.getByText('Tambah shift'));
    fireEvent.change(screen.getByLabelText('Nama shift'), { target: { value: 'MALAM' } });
    fireEvent.change(screen.getByLabelText('Mulai'), { target: { value: '23:00' } });
    fireEvent.change(screen.getByLabelText('Selesai'), { target: { value: '07:00' } });
    fireEvent.click(screen.getByText('Simpan shift'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/shifts');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.name).toBe('MALAM');
    expect(body.startTime).toBe('23:00');
    expect(body.endTime).toBe('07:00');
    // Form state is text; the BFF route coerces thresholds to numbers.
    expect(body.lateThresholdMin).toBe('30');
    expect('overnight' in body).toBe(false);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('shows the backend rejection verbatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Shift start and end cannot be equal' }),
      })),
    );
    render(<ShiftCreateForm hospitals={hospitals} />);

    fireEvent.click(screen.getByText('Tambah shift'));
    fireEvent.change(screen.getByLabelText('Nama shift'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Simpan shift'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('cannot be equal'),
    );
    vi.unstubAllGlobals();
  });
});

describe('ShiftRowActions', () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.restoreAllMocks();
  });

  it('patches the retuned window and thresholds', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<ShiftRowActions {...shiftProps} />);

    fireEvent.click(screen.getByText('Ubah'));
    fireEvent.change(screen.getByLabelText('Ambang telat (mnt)'), { target: { value: '45' } });
    fireEvent.click(screen.getByText('Simpan'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/shifts/s1');
    expect(init.method).toBe('PATCH');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.lateThresholdMin).toBe('45');
    expect(body.startTime).toBe('07:00');
    expect(body.endTime).toBe('15:00');
    expect('overnight' in body).toBe(false);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('deletes after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<ShiftRowActions {...shiftProps} />);

    fireEvent.click(screen.getByText('Hapus'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/shifts/s1');
    expect(init.method).toBe('DELETE');
    vi.unstubAllGlobals();
  });

  it('explains that a shift on a roster cannot be deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Shift is still on a roster and cannot be deleted' }),
      })),
    );
    render(<ShiftRowActions {...shiftProps} />);

    fireEvent.click(screen.getByText('Hapus'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('still on a roster'),
    );
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('keeps the draft when a save fails so it is not lost', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ message: 'nama bentrok' }) })),
    );
    render(<ShiftRowActions {...shiftProps} />);

    fireEvent.click(screen.getByText('Ubah'));
    const nameInput = screen.getByLabelText('Nama shift') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'PAGI BARU' } });
    fireEvent.click(screen.getByText('Simpan'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect((screen.getByLabelText('Nama shift') as HTMLInputElement).value).toBe('PAGI BARU');
    vi.unstubAllGlobals();
  });
});