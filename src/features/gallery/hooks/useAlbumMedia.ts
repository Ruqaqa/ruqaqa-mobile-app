import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchAlbumMedia } from '../services/galleryService';
import { MediaItem } from '../types';

interface UseAlbumMediaParams {
  albumId: string;
}

export interface UseAlbumMediaReturn {
  items: MediaItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: { code: string } | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
}

export function useAlbumMedia({ albumId }: UseAlbumMediaParams): UseAlbumMediaReturn {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<{ code: string } | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const pageRef = useRef(1);
  const isMountedRef = useRef(true);
  const stateRef = useRef({ hasMore, isLoading, isLoadingMore });
  stateRef.current = { hasMore, isLoading, isLoadingMore };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const doFetch = useCallback(
    async (page: number, currentAlbumId: string, append: boolean) => {
      try {
        const result = await fetchAlbumMedia({ albumId: currentAlbumId, page });
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
        if (err && typeof err === 'object' && 'code' in err) {
          setError(err as { code: string });
        } else {
          setError({ code: 'UNKNOWN' });
        }
      }
    },
    [],
  );

  // Initial fetch and refetch when albumId changes
  useEffect(() => {
    pageRef.current = 1;
    setIsLoading(true);
    setItems([]);
    setError(null);
    doFetch(1, albumId, false).finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [albumId, doFetch]);

  const loadMore = useCallback(() => {
    const { hasMore: hm, isLoading: il, isLoadingMore: ilm } = stateRef.current;
    if (!hm || il || ilm) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setIsLoadingMore(true);
    doFetch(nextPage, albumId, true).finally(() => {
      if (isMountedRef.current) setIsLoadingMore(false);
    });
  }, [albumId, doFetch]);

  const refresh = useCallback(() => {
    pageRef.current = 1;
    setIsRefreshing(true);
    doFetch(1, albumId, false).finally(() => {
      if (isMountedRef.current) setIsRefreshing(false);
    });
  }, [albumId, doFetch]);

  const retry = useCallback(() => {
    pageRef.current = 1;
    setIsLoading(true);
    setError(null);
    setItems([]);
    doFetch(1, albumId, false).finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [albumId, doFetch]);

  return {
    items,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    loadMore,
    refresh,
    retry,
  };
}
