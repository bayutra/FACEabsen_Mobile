import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewButtons } from './review-buttons';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

// STEP 23 — review actions hit the scoped BFF endpoint (permission flow).
describe('ReviewButtons', () => {
  it('approves via the kind-scoped endpoint and refreshes', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReviewButtons kind="leaves" id="l1" />);

    fireEvent.click(screen.getByText('Setujui'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reviews/leaves/l1/approve',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(refresh).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows an error when the backend refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
    render(<ReviewButtons kind="corrections" id="c9" />);

    fireEvent.click(screen.getByText('Tolak'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    vi.unstubAllGlobals();
  });
});
