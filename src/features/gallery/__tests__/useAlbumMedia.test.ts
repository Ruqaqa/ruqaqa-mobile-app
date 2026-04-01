import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAlbumMedia } from '../hooks/useAlbumMedia';
import * as galleryService from '../services/galleryService';
import { MediaItem, GalleryPagination } from '../types';

jest.mock('../services/galleryService', () => {
  const actual = jest.requireActual('../services/galleryService');
  return {
    ...actual,
    fetchAlbumMedia: jest.fn(),
  };
});

const mockFetch = galleryService.fetchAlbumMedia as jest.MockedFunction<
  typeof galleryService.fetchAlbumMedia
>;

const makeItem = (id: string, overrides: Partial<MediaItem> = {}): MediaItem => ({
  id,
  filename: `photo-${id}.jpg`,
  mediaType: 'image',
  thumbnailUrl: `/thumb-${id}.jpg`,
  noWatermarkNeeded: false,
  watermarkedVariantAvailable: true,
  uploadedById: 'emp-1',
  uploadedByName: 'Ahmed Ali',
  createdAt: '2025-06-01T00:00:00Z',
  ...overrides,
});

const makePagination = (
  overrides: Partial<GalleryPagination> = {},
): GalleryPagination => ({
  page: 1,
  totalDocs: 40,
  totalPages: 2,
  hasNextPage: true,
  hasPrevPage: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAlbumMedia', () => {
  it('fetches media on mount with page 1', async () => {
    mockFetch.mockResolvedValue({
      items: [makeItem('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('1');
    expect(mockFetch).toHaveBeenCalledWith({ albumId: 'album-1', page: 1 });
  });

  it('sets hasMore based on pagination', async () => {
    mockFetch.mockResolvedValue({
      items: [makeItem('1')],
      pagination: makePagination({ hasNextPage: true }),
    });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
  });

  it('loadMore appends next page of results', async () => {
    mockFetch
      .mockResolvedValueOnce({
        items: [makeItem('1')],
        pagination: makePagination({ hasNextPage: true }),
      })
      .mockResolvedValueOnce({
        items: [makeItem('2')],
        pagination: makePagination({ page: 2, hasNextPage: false }),
      });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(result.current.items[0].id).toBe('1');
    expect(result.current.items[1].id).toBe('2');
    expect(result.current.hasMore).toBe(false);
    expect(mockFetch).toHaveBeenLastCalledWith({ albumId: 'album-1', page: 2 });
  });

  it('loadMore is a no-op when hasMore is false', async () => {
    mockFetch.mockResolvedValue({
      items: [makeItem('1')],
      pagination: makePagination({ hasNextPage: false }),
    });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = mockFetch.mock.calls.length;
    act(() => {
      result.current.loadMore();
    });

    expect(mockFetch).toHaveBeenCalledTimes(callCount);
  });

  it('loadMore is a no-op while loading', async () => {
    mockFetch.mockResolvedValue({
      items: [makeItem('1')],
      pagination: makePagination({ hasNextPage: true }),
    });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    // Still loading initial
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    // Only the initial fetch should have been called
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('sets isLoadingMore during loadMore', async () => {
    let resolveSecondFetch: (value: any) => void;
    const secondFetchPromise = new Promise((resolve) => {
      resolveSecondFetch = resolve;
    });

    mockFetch
      .mockResolvedValueOnce({
        items: [makeItem('1')],
        pagination: makePagination({ hasNextPage: true }),
      })
      .mockReturnValueOnce(secondFetchPromise as any);

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.isLoadingMore).toBe(true);

    await act(async () => {
      resolveSecondFetch!({
        items: [makeItem('2')],
        pagination: makePagination({ page: 2, hasNextPage: false }),
      });
    });

    expect(result.current.isLoadingMore).toBe(false);
  });

  it('refresh resets to page 1 and replaces items', async () => {
    mockFetch.mockResolvedValue({
      items: [makeItem('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockFetch.mockResolvedValue({
      items: [makeItem('new-1'), makeItem('new-2')],
      pagination: makePagination({ totalDocs: 2 }),
    });

    act(() => {
      result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(true);

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe('new-1');
    expect(mockFetch).toHaveBeenLastCalledWith({ albumId: 'album-1', page: 1 });
  });

  it('sets error state on fetch failure', async () => {
    mockFetch.mockRejectedValue({ code: 'NETWORK' });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual({ code: 'NETWORK' });
    expect(result.current.items).toHaveLength(0);
  });

  it('retry clears error, resets items, and re-fetches page 1', async () => {
    mockFetch
      .mockRejectedValueOnce({ code: 'NETWORK' })
      .mockResolvedValue({
        items: [makeItem('1')],
        pagination: makePagination(),
      });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-1' }));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.items).toHaveLength(1);
    });
  });

  it('returns empty items for empty album without error', async () => {
    mockFetch.mockResolvedValue({
      items: [],
      pagination: makePagination({ totalDocs: 0, totalPages: 0, hasNextPage: false }),
    });

    const { result } = renderHook(() => useAlbumMedia({ albumId: 'album-empty' }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  it('refetches when albumId changes', async () => {
    mockFetch.mockResolvedValue({
      items: [makeItem('1')],
      pagination: makePagination(),
    });

    const { result, rerender } = renderHook(
      ({ albumId }: { albumId: string }) => useAlbumMedia({ albumId }),
      { initialProps: { albumId: 'album-1' } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockFetch.mockResolvedValue({
      items: [makeItem('2')],
      pagination: makePagination(),
    });

    rerender({ albumId: 'album-2' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith({ albumId: 'album-2', page: 1 });
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('2');
    });
  });
});
