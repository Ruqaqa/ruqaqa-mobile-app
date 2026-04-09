import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAlbumList } from '../hooks/useAlbumList';
import * as galleryService from '../services/galleryService';
import { GalleryAlbum } from '../types';

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
    fetchAlbums: jest.fn(),
  };
});

const mockFetchAlbums = galleryService.fetchAlbums as jest.MockedFunction<
  typeof galleryService.fetchAlbums
>;

const makeAlbum = (id: string, overrides: Partial<GalleryAlbum> = {}): GalleryAlbum => ({
  id,
  title: `Album ${id}`,
  titleEn: `Album ${id}`,
  titleAr: `ألبوم ${id}`,
  isDefault: false,
  itemCount: 3,
  coverThumbnails: [],
  createdAt: '2025-06-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAlbumList', () => {
  it('fetches albums on mount and sets loading states', async () => {
    mockFetchAlbums.mockResolvedValue({ albums: [makeAlbum('1')] });

    const { result } = renderHook(() => useAlbumList());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchAlbums).toHaveBeenCalledWith({});
  });

  it('returns fetched albums after successful load', async () => {
    mockFetchAlbums.mockResolvedValue({
      albums: [makeAlbum('1'), makeAlbum('2')],
    });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.albums).toHaveLength(2);
    expect(result.current.albums[0].id).toBe('1');
    expect(result.current.albums[1].id).toBe('2');
  });

  it('sets error state on fetch failure', async () => {
    mockFetchAlbums.mockRejectedValue({ code: 'NETWORK' });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual({ code: 'NETWORK' });
    expect(result.current.albums).toHaveLength(0);
  });

  it('retry clears error and re-fetches', async () => {
    mockFetchAlbums
      .mockRejectedValueOnce({ code: 'NETWORK' })
      .mockResolvedValue({ albums: [makeAlbum('1')] });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.albums).toHaveLength(1);
    });
  });

  it('refresh re-fetches and sets isRefreshing', async () => {
    mockFetchAlbums.mockResolvedValue({ albums: [makeAlbum('1')] });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Set up new data for refresh
    mockFetchAlbums.mockResolvedValue({
      albums: [makeAlbum('1'), makeAlbum('2')],
    });

    let refreshPromise: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      await refreshPromise;
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.albums).toHaveLength(2);
  });

  it('setSearch triggers debounced re-fetch with search param', async () => {
    mockFetchAlbums.mockResolvedValue({ albums: [makeAlbum('1')] });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockFetchAlbums.mockResolvedValue({ albums: [makeAlbum('2')] });

    act(() => {
      result.current.setSearch('photos');
    });

    // Should not have called yet (debounce)
    expect(mockFetchAlbums).toHaveBeenCalledTimes(1); // only initial

    // Advance past debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetchAlbums).toHaveBeenLastCalledWith({ search: 'photos' });
    });

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(1);
      expect(result.current.albums[0].id).toBe('2');
    });
  });

  it('updateAlbumLocally updates a single album in list', async () => {
    mockFetchAlbums.mockResolvedValue({
      albums: [makeAlbum('1'), makeAlbum('2')],
    });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(2);
    });

    act(() => {
      result.current.updateAlbumLocally('1', { title: 'Renamed', titleEn: 'Renamed' });
    });

    expect(result.current.albums[0].title).toBe('Renamed');
    expect(result.current.albums[0].titleEn).toBe('Renamed');
    // Other album unchanged
    expect(result.current.albums[1].id).toBe('2');
    expect(result.current.albums[1].title).toBe('Album 2');
  });

  it('removeAlbumLocally removes album from list', async () => {
    mockFetchAlbums.mockResolvedValue({
      albums: [makeAlbum('1'), makeAlbum('2'), makeAlbum('3')],
    });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(3);
    });

    act(() => {
      result.current.removeAlbumLocally('2');
    });

    expect(result.current.albums).toHaveLength(2);
    expect(result.current.albums.map((a) => a.id)).toEqual(['1', '3']);
  });

  it('removeAlbumLocally is a no-op when id does not exist', async () => {
    mockFetchAlbums.mockResolvedValue({
      albums: [makeAlbum('1'), makeAlbum('2')],
    });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(2);
    });

    act(() => {
      result.current.removeAlbumLocally('nonexistent');
    });

    expect(result.current.albums).toHaveLength(2);
  });

  it('addAlbumLocally prepends album to list', async () => {
    mockFetchAlbums.mockResolvedValue({ albums: [makeAlbum('1')] });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(1);
    });

    const newAlbum = makeAlbum('new');
    act(() => {
      result.current.addAlbumLocally(newAlbum);
    });

    expect(result.current.albums).toHaveLength(2);
    expect(result.current.albums[0].id).toBe('new');
    expect(result.current.albums[1].id).toBe('1');
  });

  it('hasActiveFilters is true when search is non-empty', async () => {
    mockFetchAlbums.mockResolvedValue({ albums: [] });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.setSearch('test');
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('returns empty albums array when fetch returns empty', async () => {
    mockFetchAlbums.mockResolvedValue({ albums: [] });

    const { result } = renderHook(() => useAlbumList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.albums).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
