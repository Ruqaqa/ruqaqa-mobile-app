import { useEffect } from 'react';

type ListApi = { refresh: () => void };

export function useExposeRefresh(
  onReady: ((api: ListApi) => void) | undefined,
  refresh: () => void,
): void {
  useEffect(() => {
    onReady?.({ refresh });
  }, [onReady, refresh]);
}
