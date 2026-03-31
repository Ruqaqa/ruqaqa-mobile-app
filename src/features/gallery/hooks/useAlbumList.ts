import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchAlbums } from '../services/galleryService';
import { GalleryAlbum } from '../types';
import { sanitizeAlbumSearch } from '../utils/validation';

export interface UseAlbumListReturn {
  albums: GalleryAlbum[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: { code: string } | null;
  search: string;
  setSearch: (query: string) => void;
  hasActiveFilters: boolean;
  refresh: () => Promise<void>;
  retry: () => void;
  updateAlbumLocally: (id: string, partial: Partial<GalleryAlbum>) => void;
  addAlbumLocally: (album: GalleryAlbum) => void;
}

export function useAlbumList(): UseAlbumListReturn {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<{ code: string } | null>(null);
  const [search, setSearchState] = useState('');

  const isMountedRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const doFetch = useCallback(async (searchQuery?: string) => {
    const params: { search?: string } = {};
    if (searchQuery) {
      params.search = searchQuery;
    }

    try {
      const result = await fetchAlbums(params);
      if (!isMountedRef.current) return;
      setAlbums(result.albums);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err && typeof err === 'object' && 'code' in err) {
        setError(err as { code: string });
      } else {
        setError({ code: 'UNKNOWN' });
      }
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    setIsLoading(true);
    doFetch().finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [doFetch]);

  const setSearch = useCallback(
    (query: string) => {
      setSearchState(query);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        const sanitized = sanitizeAlbumSearch(query);
        doFetch(sanitized || undefined);
      }, 300);
    },
    [doFetch],
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    const sanitized = sanitizeAlbumSearch(search);
    await doFetch(sanitized || undefined);
    if (isMountedRef.current) setIsRefreshing(false);
  }, [doFetch, search]);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setAlbums([]);
    doFetch().finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [doFetch]);

  const updateAlbumLocally = useCallback(
    (id: string, partial: Partial<GalleryAlbum>) => {
      setAlbums((prev) =>
        prev.map((album) => (album.id === id ? { ...album, ...partial } : album)),
      );
    },
    [],
  );

  const addAlbumLocally = useCallback((album: GalleryAlbum) => {
    setAlbums((prev) => [album, ...prev]);
  }, []);

  return {
    albums,
    isLoading,
    isRefreshing,
    error,
    search,
    setSearch,
    hasActiveFilters: search.trim().length > 0,
    refresh,
    retry,
    updateAlbumLocally,
    addAlbumLocally,
  };
}
