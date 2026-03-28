import { apiClient } from '@/services/apiClient';

const DEBOUNCE_MS = 300;

interface AutocompleteConfig {
  endpoint: string;
  resultKey: string;
  /** When true, empty queries return [] without hitting API */
  requireQuery?: boolean;
  limit?: number;
}

export interface AutocompleteResult {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface AutocompleteSearch {
  search: (query: string) => Promise<AutocompleteResult[]>;
  cancel: () => void;
}

export function createAutocompleteSearch(
  config: AutocompleteConfig,
): AutocompleteSearch {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let cache: AutocompleteResult[] = [];
  let latestResolve: ((results: AutocompleteResult[]) => void) | null = null;

  function filterCache(query: string): AutocompleteResult[] {
    const lower = query.toLowerCase();
    return cache.filter((item) =>
      item.name.toLowerCase().includes(lower),
    );
  }

  function cancel() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function search(query: string): Promise<AutocompleteResult[]> {
    cancel();

    return new Promise<AutocompleteResult[]>((resolve) => {
      if (config.requireQuery && !query.trim()) {
        resolve([]);
        return;
      }

      latestResolve = resolve;

      debounceTimer = setTimeout(async () => {
        try {
          const response = await apiClient.get(config.endpoint, {
            params: {
              q: query,
              limit: config.limit ?? 10,
            },
          });

          const results: AutocompleteResult[] =
            response.data[config.resultKey] ?? [];

          // Update cache with successful results
          if (results.length > 0 || !query.trim()) {
            cache = results;
          }

          resolve(results);
        } catch {
          // Fall back to local cache filtering
          resolve(query.trim() ? filterCache(query) : cache);
        }
      }, DEBOUNCE_MS);
    });
  }

  return { search, cancel };
}
