import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchTags } from '../services/galleryService';
import { PickerItem } from '../types';

export interface UseTagListReturn {
  tags: PickerItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: { code: string } | null;
  search: string;
  setSearch: (query: string) => void;
  hasActiveFilters: boolean;
  refresh: () => Promise<void>;
  retry: () => void;
  updateTagLocally: (id: string, partial: Partial<PickerItem>) => void;
  addTagLocally: (tag: PickerItem) => void;
  removeTagLocally: (id: string) => void;
}

export function useTagList(): UseTagListReturn {
  const [tags, setTags] = useState<PickerItem[]>([]);
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

  const doFetch = useCallback(async (query: string) => {
    try {
      const result = await fetchTags(query);
      if (!isMountedRef.current) return;
      setTags(result);
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

  useEffect(() => {
    setIsLoading(true);
    doFetch('').finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [doFetch]);

  const setSearch = useCallback(
    (query: string) => {
      setSearchState(query);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        doFetch(query);
      }, 300);
    },
    [doFetch],
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await doFetch(search);
    if (isMountedRef.current) setIsRefreshing(false);
  }, [doFetch, search]);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setTags([]);
    doFetch(search).finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [doFetch, search]);

  const updateTagLocally = useCallback(
    (id: string, partial: Partial<PickerItem>) => {
      setTags((prev) =>
        prev.map((tag) => (tag.id === id ? { ...tag, ...partial } : tag)),
      );
    },
    [],
  );

  const addTagLocally = useCallback((tag: PickerItem) => {
    setTags((prev) => [tag, ...prev]);
  }, []);

  const removeTagLocally = useCallback((id: string) => {
    setTags((prev) => prev.filter((tag) => tag.id !== id));
  }, []);

  return {
    tags,
    isLoading,
    isRefreshing,
    error,
    search,
    setSearch,
    hasActiveFilters: search.trim().length > 0,
    refresh,
    retry,
    updateTagLocally,
    addTagLocally,
    removeTagLocally,
  };
}
