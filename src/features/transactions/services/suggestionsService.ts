import { apiClient } from '@/services/apiClient';

export interface SuggestionItem {
  id: string;
  name: string;
  [key: string]: any;
}

async function fetchSuggestions(
  endpoint: string,
  query: string,
  resultKey: string,
  limit: number,
): Promise<SuggestionItem[]> {
  try {
    const res = await apiClient.get(endpoint, {
      params: { q: query, limit },
    });
    if (res.data?.success && Array.isArray(res.data[resultKey])) {
      return res.data[resultKey];
    }
  } catch {
    // swallow — return empty
  }
  return [];
}

export function fetchProjectSuggestions(query: string): Promise<SuggestionItem[]> {
  const limit = query.trim() ? 10 : 7;
  return fetchSuggestions('/projects', query, 'projects', limit);
}

export function fetchClientSuggestions(query: string): Promise<SuggestionItem[]> {
  const limit = query.trim() ? 10 : 7;
  return fetchSuggestions('/clients', query, 'clients', limit);
}

export function fetchOtherPartySuggestions(query: string): Promise<SuggestionItem[]> {
  if (!query.trim()) return Promise.resolve([]);
  return fetchSuggestions('/other-parties', query, 'otherParties', 10);
}

export function fetchEmployeeSuggestions(query: string): Promise<SuggestionItem[]> {
  return fetchSuggestions('/employees', query, 'employees', 100);
}
