import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuthHeaders } from '../useAuthHeaders';

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();

jest.mock('@/services/tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: (...args: any[]) => mockGetAccessToken(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAuthHeaders', () => {
  it('returns undefined initially before token is loaded', () => {
    mockGetAccessToken.mockResolvedValue('test-token');

    const { result } = renderHook(() => useAuthHeaders());

    expect(result.current).toBeUndefined();
  });

  it('returns Authorization header after token is loaded', async () => {
    mockGetAccessToken.mockResolvedValue('test-token');

    const { result } = renderHook(() => useAuthHeaders());

    await waitFor(() => {
      expect(result.current).toEqual({ Authorization: 'Bearer test-token' });
    });
  });

  it('returns undefined when no token is available', async () => {
    mockGetAccessToken.mockResolvedValue(null);

    const { result } = renderHook(() => useAuthHeaders());

    await waitFor(() => {
      expect(mockGetAccessToken).toHaveBeenCalled();
    });

    expect(result.current).toBeUndefined();
  });

  it('refreshes the token on interval', async () => {
    mockGetAccessToken.mockResolvedValue('token-v1');

    const { result } = renderHook(() => useAuthHeaders());

    await waitFor(() => {
      expect(result.current).toEqual({ Authorization: 'Bearer token-v1' });
    });

    // Token changes on next read
    mockGetAccessToken.mockResolvedValue('token-v2');

    // Advance past the refresh interval (30 seconds)
    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    await waitFor(() => {
      expect(result.current).toEqual({ Authorization: 'Bearer token-v2' });
    });

    expect(mockGetAccessToken).toHaveBeenCalledTimes(2);
  });

  it('cleans up interval on unmount', async () => {
    mockGetAccessToken.mockResolvedValue('test-token');

    const { result, unmount } = renderHook(() => useAuthHeaders());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    unmount();

    // Advance timers — should not call getAccessToken again
    const callCountAtUnmount = mockGetAccessToken.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(mockGetAccessToken).toHaveBeenCalledTimes(callCountAtUnmount);
  });
});
