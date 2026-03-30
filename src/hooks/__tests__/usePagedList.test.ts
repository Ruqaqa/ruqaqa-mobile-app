import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePagedList } from '../usePagedList';

interface TestItem {
  id: string;
  name: string;
}

interface TestFilters {
  query: string;
}

const EMPTY_FILTERS: TestFilters = { query: '' };

const makeItem = (id: string): TestItem => ({ id, name: `Item ${id}` });

const makeFetchFn = () =>
  jest.fn<
    Promise<{
      items: TestItem[];
      pagination: { hasNextPage: boolean; totalPages: number; page: number };
    }>,
    [{ page: number; showOwn: boolean; filters: TestFilters }]
  >();

const hasActiveFiltersFn = (f: TestFilters) => f.query !== '';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePagedList', () => {
  it('fetches initial data on mount', async () => {
    const fetchFn = makeFetchFn();
    fetchFn.mockResolvedValue({
      items: [makeItem('1')],
      pagination: { hasNextPage: true, totalPages: 2, page: 1 },
    });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.showOwn).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith({
      page: 1,
      showOwn: true,
      filters: EMPTY_FILTERS,
    });
  });

  it('loadMore appends data', async () => {
    const fetchFn = makeFetchFn();
    fetchFn
      .mockResolvedValueOnce({
        items: [makeItem('1')],
        pagination: { hasNextPage: true, totalPages: 2, page: 1 },
      })
      .mockResolvedValueOnce({
        items: [makeItem('2')],
        pagination: { hasNextPage: false, totalPages: 2, page: 2 },
      });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('setShowOwn resets and refetches', async () => {
    const fetchFn = makeFetchFn();
    fetchFn.mockResolvedValue({
      items: [makeItem('1')],
      pagination: { hasNextPage: false, totalPages: 1, page: 1 },
    });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setShowOwn(false);
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, showOwn: false }),
      );
    });
  });

  it('setFilters resets and refetches', async () => {
    const fetchFn = makeFetchFn();
    fetchFn.mockResolvedValue({
      items: [makeItem('1')],
      pagination: { hasNextPage: false, totalPages: 1, page: 1 },
    });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'test' });
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: { query: 'test' },
        }),
      );
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clearFilters resets to empty', async () => {
    const fetchFn = makeFetchFn();
    fetchFn.mockResolvedValue({
      items: [makeItem('1')],
      pagination: { hasNextPage: false, totalPages: 1, page: 1 },
    });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'test' });
    });

    await waitFor(() => expect(result.current.hasActiveFilters).toBe(true));

    act(() => {
      result.current.clearFilters();
    });

    await waitFor(() => {
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  it('refresh resets page', async () => {
    const fetchFn = makeFetchFn();
    fetchFn.mockResolvedValue({
      items: [makeItem('1')],
      pagination: { hasNextPage: false, totalPages: 1, page: 1 },
    });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'test' });
    });

    await waitFor(() => expect(result.current.hasActiveFilters).toBe(true));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: { query: 'test' },
        }),
      );
    });
  });

  it('retry after error', async () => {
    const fetchFn = makeFetchFn();
    fetchFn
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({
        items: [makeItem('1')],
        pagination: { hasNextPage: false, totalPages: 1, page: 1 },
      });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.items).toHaveLength(1);
    });
  });

  it('updateItem merges partial', async () => {
    const fetchFn = makeFetchFn();
    fetchFn.mockResolvedValue({
      items: [makeItem('1'), makeItem('2')],
      pagination: { hasNextPage: false, totalPages: 1, page: 1 },
    });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.updateItem('1', { name: 'Updated' });
    });

    expect(result.current.items[0].name).toBe('Updated');
    expect(result.current.items[1].id).toBe('2');
  });

  it('canViewAll=false forces showOwn=true', async () => {
    const fetchFn = makeFetchFn();
    fetchFn.mockResolvedValue({
      items: [makeItem('1')],
      pagination: { hasNextPage: false, totalPages: 1, page: 1 },
    });

    const { result } = renderHook(() =>
      usePagedList({
        fetchFn,
        emptyFilters: EMPTY_FILTERS,
        hasActiveFiltersFn,
        canViewAll: false,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = fetchFn.mock.calls.length;
    act(() => {
      result.current.setShowOwn(false);
    });

    expect(result.current.showOwn).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(callCount);
  });
});
