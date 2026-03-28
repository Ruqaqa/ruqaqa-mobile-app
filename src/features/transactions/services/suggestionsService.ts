import { apiClient } from '@/services/apiClient';

export interface SuggestionItem {
  id: string;
  name: string;
}

export interface OtherPartySuggestion {
  id?: string;
  name: string;
  type: string;
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

export async function fetchOtherPartySuggestions(query: string): Promise<OtherPartySuggestion[]> {
  if (!query.trim()) return [];
  try {
    const res = await apiClient.get('/other-parties', {
      params: { q: query, limit: 10 },
    });
    if (res.data?.success && Array.isArray(res.data.otherParties)) {
      return res.data.otherParties;
    }
  } catch {
    // swallow — return empty
  }
  return [];
}

export function fetchEmployeeSuggestions(query: string): Promise<SuggestionItem[]> {
  return fetchSuggestions('/employees', query, 'employees', 100);
}
