import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleCreateForm } from './schedule-create-form';
import { ScheduleRowActions } from './schedule-row-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

const employees = [{ id: 'e1', employeeNo: 'EMP-001', name: 'Siti' }];
const shifts = [
  { id: 's1', name: 'PAGI', startTime: '07:00', endTime: '15:00', overnight: false },
];

function ok() {
  return { ok: true, status: 200, json: async () => ({}) };
}

describe('ScheduleCreateForm', () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it('posts employee, shift and date', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<ScheduleCreateForm employees={employees} shifts={shifts} />);

    fireEvent.click(screen.getByText('Assign shift'));
    fireEvent.change(screen.getByLabelText('Tanggal kerja'), { target: { value: '2026-10-09' } });
    fireEvent.click(screen.getByText('Simpan jadwal'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/schedules');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      employeeId: 'e1',
      shiftId: 's1',
      workDate: '2026-10-09',
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('shows the night-shift window in the picker', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    render(
      <ScheduleCreateForm
        employees={employees}
        shifts={[{ id: 's2', name: 'MALAM', startTime: '23:00', endTime: '07:00', overnight: true }]}
      />,
    );

    fireEvent.click(screen.getByText('Assign shift'));
    expect(screen.getByText('MALAM · 23:00 → 07:00 (+1 hari)')).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('surfaces the duplicate-date rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Employee already scheduled on this date' }),
      })),
    );
    render(<ScheduleCreateForm employees={employees} shifts={shifts} />);

    fireEvent.click(screen.getByText('Assign shift'));
    fireEvent.change(screen.getByLabelText('Tanggal kerja'), { target: { value: '2026-10-09' } });
    fireEvent.click(screen.getByText('Simpan jadwal'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('already scheduled'),
    );
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('disables the button when there is no employee or no shift to assign', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const { unmount } = render(<ScheduleCreateForm employees={[]} shifts={shifts} />);
    expect(screen.getByText('Assign shift').hasAttribute('disabled')).toBe(true);
    unmount();

    render(<ScheduleCreateForm employees={employees} shifts={[]} />);
    expect(screen.getByText('Assign shift').hasAttribute('disabled')).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('ScheduleRowActions', () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.restoreAllMocks();
  });

  it('deletes after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<ScheduleRowActions id="sch1" employeeName="Siti" workDate="2026-10-09" />);

    fireEvent.click(screen.getByText('Hapus'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/schedules/sch1');
    expect(init.method).toBe('DELETE');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('does not call the API when the confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    render(<ScheduleRowActions id="sch1" employeeName="Siti" workDate="2026-10-09" />);

    fireEvent.click(screen.getByText('Hapus'));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('explains that a roster row with attendance cannot be removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Schedule has attendance and cannot be removed' }),
      })),
    );
    render(<ScheduleRowActions id="sch1" employeeName="Siti" workDate="2026-10-09" />);

    fireEvent.click(screen.getByText('Hapus'));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('cannot be removed'),
    );
    expect(refresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});