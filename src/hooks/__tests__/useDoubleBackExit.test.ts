// jest-expo automocks react-native; BackHandler/ToastAndroid are undefined
// unless we unmock. This hook reads real RN primitives.
jest.unmock('react-native');

import { renderHook } from '@testing-library/react-native';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { useDoubleBackExit, DOUBLE_BACK_THRESHOLD_MS } from '../useDoubleBackExit';

// Use realistic timestamps (like production Date.now())
const BASE_TIME = 1_711_929_600_000; // 2024-04-01T00:00:00Z

// Capture the registered back handler callback
let backHandlerCallback: (() => boolean) | null = null;
const mockRemove = jest.fn();

beforeEach(() => {
  backHandlerCallback = null;
  mockRemove.mockClear();

  // Ensure we're on Android for tests
  (Platform as any).OS = 'android';

  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(
    ((_event: string, handler: () => boolean) => {
      backHandlerCallback = handler;
      return { remove: mockRemove };
    }) as any,
  );
  jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
  jest.spyOn(ToastAndroid, 'show').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function pressBack(): boolean {
  expect(backHandlerCallback).not.toBeNull();
  return backHandlerCallback!();
}

describe('useDoubleBackExit', () => {
  it('registers a BackHandler listener on Android', () => {
    renderHook(() => useDoubleBackExit('Press back again'));

    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
  });

  it('does not register a BackHandler listener on iOS', () => {
    (Platform as any).OS = 'ios';

    renderHook(() => useDoubleBackExit('Press back again'));

    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });

  it('shows toast on first back press', () => {
    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    const result = pressBack();

    expect(ToastAndroid.show).toHaveBeenCalledWith('Press back again', ToastAndroid.SHORT);
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('exits app on second back press within threshold', () => {
    const nowMock = jest.spyOn(Date, 'now');
    nowMock.mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    // First press
    pressBack();

    // Second press 1500ms later (within 2000ms threshold)
    nowMock.mockReturnValue(BASE_TIME + 1500);
    const result = pressBack();

    expect(BackHandler.exitApp).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('resets timer when presses are spaced far apart', () => {
    const nowMock = jest.spyOn(Date, 'now');
    nowMock.mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    // First press
    pressBack();
    expect(ToastAndroid.show).toHaveBeenCalledTimes(1);

    // Second press 4000ms later (beyond 2000ms threshold)
    nowMock.mockReturnValue(BASE_TIME + 4000);
    pressBack();

    // Should show toast again, not exit
    expect(ToastAndroid.show).toHaveBeenCalledTimes(2);
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
  });

  it('exits on double press after a reset', () => {
    const nowMock = jest.spyOn(Date, 'now');
    nowMock.mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    // First press
    pressBack();

    // Second press 4000ms later (too late — resets)
    nowMock.mockReturnValue(BASE_TIME + 4000);
    pressBack();

    // Third press 1000ms after reset (within threshold)
    nowMock.mockReturnValue(BASE_TIME + 5000);
    pressBack();

    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
  });

  it('does not exit when second press is exactly at the threshold boundary', () => {
    const nowMock = jest.spyOn(Date, 'now');
    nowMock.mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    // First press
    pressBack();

    // Second press exactly 2000ms later (NOT less than 2000)
    nowMock.mockReturnValue(BASE_TIME + 2000);
    pressBack();

    // 2000 is not < 2000, so this should NOT exit
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(ToastAndroid.show).toHaveBeenCalledTimes(2);
  });

  it('exits when second press is 1ms before the threshold boundary', () => {
    const nowMock = jest.spyOn(Date, 'now');
    nowMock.mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    // First press
    pressBack();

    // Second press 1999ms later (just under 2000ms)
    nowMock.mockReturnValue(BASE_TIME + 1999);
    pressBack();

    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
  });

  it('handles rapid triple press — exits on second', () => {
    const nowMock = jest.spyOn(Date, 'now');
    nowMock.mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    // Three rapid presses
    pressBack(); // toast
    nowMock.mockReturnValue(BASE_TIME + 100);
    pressBack(); // exit (100ms < 2000ms)
    nowMock.mockReturnValue(BASE_TIME + 200);
    pressBack(); // exit again (still within threshold)

    expect(ToastAndroid.show).toHaveBeenCalledTimes(1);
    expect(BackHandler.exitApp).toHaveBeenCalledTimes(2);
  });

  it('always returns true to prevent default back navigation', () => {
    const nowMock = jest.spyOn(Date, 'now');
    nowMock.mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('Press back again'));

    // First press (toast path)
    expect(pressBack()).toBe(true);

    // Second press (exit path)
    nowMock.mockReturnValue(BASE_TIME + 500);
    expect(pressBack()).toBe(true);
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useDoubleBackExit('Press back again'));

    unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('uses the provided toast message', () => {
    jest.spyOn(Date, 'now').mockReturnValue(BASE_TIME);

    renderHook(() => useDoubleBackExit('اضغط مرة أخرى للخروج'));

    pressBack();

    expect(ToastAndroid.show).toHaveBeenCalledWith(
      'اضغط مرة أخرى للخروج',
      ToastAndroid.SHORT,
    );
  });

  it('exports the threshold constant as 2000ms', () => {
    expect(DOUBLE_BACK_THRESHOLD_MS).toBe(2000);
  });
});
