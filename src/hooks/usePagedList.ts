import { useState, useCallback, useEffect, useRef } from 'react';
import { ApiError } from '@/services/errors';

interface UsePagedListOptions<TItem, TFilters> {
  fetchFn: (params: { page: number; showOwn: boolean; filters: TFilters }) => Promise<{
    items: TItem[];
    pagination: { hasNextPage: boolean; totalPages: number; page: number };
  }>;
  emptyFilters: TFilters;
  hasActiveFiltersFn: (filters: TFilters) => boolean;
  canViewAll: boolean;
  pageSize?: number;
}

interface UsePagedListReturn<TItem, TFilters> {
  items: TItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: ApiError | null;
  hasMore: boolean;
  showOwn: boolean;
  filters: TFilters;
  hasActiveFilters: boolean;
  setShowOwn: (own: boolean) => void;
  setFilters: (filters: TFilters) => void;
  clearFilters: () => void;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
  updateItem: (id: string, partial: Partial<TItem>) => void;
}

export function usePagedList<TItem extends { id: string }, TFilters>({
  fetchFn,
  emptyFilters,
  hasActiveFiltersFn,
  canViewAll,
}: UsePagedListOptions<TItem, TFilters>): UsePagedListReturn<TItem, TFilters> {
  const [items, setItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showOwn, setShowOwnState] = useState(true);
  const [filters, setFiltersState] = useState<TFilters>(emptyFilters);
  const pageRef = useRef(1);
  const isMountedRef = useRef(true);
  const stateRef = useRef({ hasMore, isLoading, isLoadingMore, showOwn, filters });
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  stateRef.current = { hasMore, isLoading, isLoadingMore, showOwn, filters };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const doFetch = useCallback(
    async (page: number, currentShowOwn: boolean, currentFilters: TFilters, append: boolean) => {
      try {
        const result = await fetchFnRef.current({
          page,
          showOwn: currentShowOwn,
          filters: currentFilters,
        });
        if (!isMountedRef.current) return;
        if (append) {
          setItems((prev) => [...prev, ...result.items]);
        } else {
          setItems(result.items);
        }
        setHasMore(result.pagination.hasNextPage);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        if (err instanceof ApiError) {
          setError(err);
        } else {
          setError(new ApiError('UNKNOWN'));
        }
      }
    },
    [],
  );

  // Initial fetch and refetch on showOwn/filters change
  useEffect(() => {
    pageRef.current = 1;
    setIsLoading(true);
    setItems([]);
    doFetch(1, showOwn, filters, false).finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [showOwn, filters, doFetch]);

  const setShowOwn = useCallback(
    (own: boolean) => {
      if (!canViewAll) return;
      setShowOwnState(own);
    },
    [canViewAll],
  );

  const setFilters = useCallback((newFilters: TFilters) => {
    setFiltersState(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(emptyFilters);
  }, [emptyFilters]);

  const loadMore = useCallback(() => {
    const { hasMore: hm, isLoading: il, isLoadingMore: ilm, showOwn: so, filters: f } = stateRef.current;
    if (!hm || il || ilm) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setIsLoadingMore(true);
    doFetch(nextPage, so, f, true).finally(() => {
      if (isMountedRef.current) setIsLoadingMore(false);
    });
  }, [doFetch]);

  const refresh = useCallback(() => {
    const { showOwn: so, filters: f } = stateRef.current;
    pageRef.current = 1;
    setIsRefreshing(true);
    doFetch(1, so, f, false).finally(() => {
      if (isMountedRef.current) setIsRefreshing(false);
    });
  }, [doFetch]);

  const retry = useCallback(() => {
    const { showOwn: so, filters: f } = stateRef.current;
    pageRef.current = 1;
    setIsLoading(true);
    setError(null);
    setItems([]);
    doFetch(1, so, f, false).finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [doFetch]);

  const updateItem = useCallback(
    (id: string, partial: Partial<TItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      );
    },
    [],
  );

  return {
    items,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    showOwn,
    filters,
    hasActiveFilters: hasActiveFiltersFn(filters),
    setShowOwn,
    setFilters,
    clearFilters,
    loadMore,
    refresh,
    retry,
    updateItem,
  };
}
