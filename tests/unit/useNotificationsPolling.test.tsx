import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every list fetch goes through from('notifications').select('*').order(...).
const listFetch = vi.fn(() => Promise.resolve({ data: [], error: null }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: () => ({ select: () => ({ order: listFetch }) }),
  }),
}));

const { useNotifications, POLL_MS } = await import('@/lib/notifications');

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  listFetch.mockClear();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => vi.useRealTimers());

async function mounted() {
  renderHook(() => useNotifications());
  // Let the on-mount refresh + first fetch settle.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return listFetch.mock.calls.length;
}

describe('useNotifications — live updates', () => {
  it('re-fetches the list every POLL_MS while the tab is visible', async () => {
    const afterMount = await mounted();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(listFetch.mock.calls.length).toBe(afterMount + 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(listFetch.mock.calls.length).toBe(afterMount + 2);
  });

  it('does not poll while the tab is hidden', async () => {
    const afterMount = await mounted();
    visibility = 'hidden';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });
    expect(listFetch.mock.calls.length).toBe(afterMount);
  });

  it('catches up immediately when the member comes back to the tab', async () => {
    const afterMount = await mounted();
    visibility = 'hidden';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    });
    visibility = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(listFetch.mock.calls.length).toBe(afterMount + 1);
  });
});
