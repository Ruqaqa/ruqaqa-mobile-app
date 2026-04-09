import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTagList } from '../hooks/useTagList';
import * as galleryService from '../services/galleryService';
import { PickerItem } from '../types';

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

jest.mock('../services/galleryService', () => {
  const actual = jest.requireActual('../services/galleryService');
  return {
    ...actual,
    fetchTags: jest.fn(),
  };
});

const mockFetchTags = galleryService.fetchTags as jest.MockedFunction<
  typeof galleryService.fetchTags
>;

const makeTag = (id: string, name: string): PickerItem => ({ id, name });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useTagList', () => {
  it('fetches tags on mount and sets loading states', async () => {
    mockFetchTags.mockResolvedValue([makeTag('1', 'nature')]);

    const { result } = renderHook(() => useTagList());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchTags).toHaveBeenCalledWith('');
  });

  it('returns fetched tags after successful load', async () => {
    mockFetchTags.mockResolvedValue([
      makeTag('1', 'nature'),
      makeTag('2', 'portrait'),
    ]);

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tags).toHaveLength(2);
    expect(result.current.tags[0].id).toBe('1');
    expect(result.current.tags[1].name).toBe('portrait');
  });

  it('sets error state on fetch failure', async () => {
    mockFetchTags.mockRejectedValue({ code: 'NETWORK' });

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual({ code: 'NETWORK' });
    expect(result.current.tags).toHaveLength(0);
  });

  it('setSearch triggers debounced re-fetch with query', async () => {
    mockFetchTags.mockResolvedValue([makeTag('1', 'nature')]);

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockFetchTags.mockResolvedValue([makeTag('2', 'portrait')]);

    act(() => {
      result.current.setSearch('port');
    });

    // Debounced — should not have re-fetched yet
    expect(mockFetchTags).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetchTags).toHaveBeenLastCalledWith('port');
    });

    await waitFor(() => {
      expect(result.current.tags[0].id).toBe('2');
    });
  });

  it('refresh re-fetches tags and toggles isRefreshing', async () => {
    mockFetchTags.mockResolvedValue([makeTag('1', 'nature')]);

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockFetchTags.mockResolvedValue([
      makeTag('1', 'nature'),
      makeTag('2', 'portrait'),
    ]);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      await refreshPromise;
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.tags).toHaveLength(2);
  });

  it('retry clears error and re-fetches', async () => {
    mockFetchTags
      .mockRejectedValueOnce({ code: 'NETWORK' })
      .mockResolvedValue([makeTag('1', 'nature')]);

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.tags).toHaveLength(1);
    });
  });

  it('addTagLocally prepends tag to list', async () => {
    mockFetchTags.mockResolvedValue([makeTag('1', 'nature')]);

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.tags).toHaveLength(1);
    });

    act(() => {
      result.current.addTagLocally(makeTag('2', 'new'));
    });

    expect(result.current.tags).toHaveLength(2);
    expect(result.current.tags[0].id).toBe('2');
  });

  it('updateTagLocally updates a single tag', async () => {
    mockFetchTags.mockResolvedValue([
      makeTag('1', 'nature'),
      makeTag('2', 'portrait'),
    ]);

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.tags).toHaveLength(2);
    });

    act(() => {
      result.current.updateTagLocally('1', { name: 'nature-renamed' });
    });

    expect(result.current.tags[0].name).toBe('nature-renamed');
    expect(result.current.tags[1].name).toBe('portrait');
  });

  it('removeTagLocally removes tag by id', async () => {
    mockFetchTags.mockResolvedValue([
      makeTag('1', 'nature'),
      makeTag('2', 'portrait'),
      makeTag('3', 'landscape'),
    ]);

    const { result } = renderHook(() => useTagList());

    await waitFor(() => {
      expect(result.current.tags).toHaveLength(3);
    });

    act(() => {
      result.current.removeTagLocally('2');
    });

    expect(result.current.tags).toHaveLength(2);
    expect(result.current.tags.map((t) => t.id)).toEqual(['1', '3']);
  });
});
