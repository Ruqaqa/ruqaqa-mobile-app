// jest-expo automocks react-native; renderHook needs it real.
jest.unmock('react-native');

import { renderHook } from '@testing-library/react-native';
import { useExposeRefresh } from '../useExposeRefresh';

describe('useExposeRefresh', () => {
  it('calls onReady once on mount with the refresh function ref', () => {
    const onReady = jest.fn();
    const refresh = jest.fn();

    renderHook(() => useExposeRefresh(onReady, refresh));

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith({ refresh });
    // The exposed refresh must be the exact same function reference,
    // not a re-bound wrapper.
    expect(onReady.mock.calls[0][0].refresh).toBe(refresh);
  });

  it('does not re-call onReady when rerendered with stable args', () => {
    const onReady = jest.fn();
    const refresh = jest.fn();

    const { rerender } = renderHook(
      ({ cb, fn }: { cb: typeof onReady; fn: typeof refresh }) =>
        useExposeRefresh(cb, fn),
      { initialProps: { cb: onReady, fn: refresh } },
    );

    rerender({ cb: onReady, fn: refresh });
    rerender({ cb: onReady, fn: refresh });

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when onReady is undefined', () => {
    const refresh = jest.fn();

    expect(() => {
      renderHook(() => useExposeRefresh(undefined, refresh));
    }).not.toThrow();
  });
});
