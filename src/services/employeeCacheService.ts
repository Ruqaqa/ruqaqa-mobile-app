import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';

const CACHE_KEY = 'cached_employees';
const CACHE_TIMESTAMP_KEY = 'cached_employees_timestamp';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedEmployee {
  id: string;
  name: string;
  email?: string;
  gender?: string;
}

let memoryCache: CachedEmployee[] | null = null;

async function getFromStorage(): Promise<CachedEmployee[]> {
  try {
    const json = await AsyncStorage.getItem(CACHE_KEY);
    if (json) return JSON.parse(json);
  } catch {
    // ignore read errors
  }
  return [];
}

async function saveToStorage(employees: CachedEmployee[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(employees));
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
  } catch {
    // ignore write errors
  }
}

async function isCacheExpired(): Promise<boolean> {
  try {
    const ts = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!ts) return true;
    return Date.now() - Number(ts) > CACHE_EXPIRY_MS;
  } catch {
    return true;
  }
}

async function fetchFromApi(): Promise<CachedEmployee[]> {
  try {
    const res = await apiClient.get('/employees', { params: { q: '', limit: 100 } });
    if (res.data?.success && Array.isArray(res.data.employees)) {
      return res.data.employees as CachedEmployee[];
    }
  } catch {
    // network error — fall through
  }
  return [];
}

/**
 * Get employees with stale-while-revalidate.
 * Returns cached data immediately, triggers background refresh if expired.
 */
export async function getEmployees(): Promise<CachedEmployee[]> {
  // Return memory cache if available
  if (memoryCache && memoryCache.length > 0) {
    // Trigger background refresh if expired
    isCacheExpired().then((expired) => {
      if (expired) refreshInBackground();
    });
    return memoryCache;
  }

  // Try storage cache
  const stored = await getFromStorage();
  if (stored.length > 0) {
    memoryCache = stored;
    // Trigger background refresh if expired
    isCacheExpired().then((expired) => {
      if (expired) refreshInBackground();
    });
    return stored;
  }

  // No cache at all — must fetch
  const fresh = await fetchFromApi();
  if (fresh.length > 0) {
    memoryCache = fresh;
    await saveToStorage(fresh);
  }
  return fresh;
}

/**
 * Initialize cache on app startup. Call after authentication.
 */
export async function initializeEmployeeCache(): Promise<void> {
  const expired = await isCacheExpired();
  if (expired) {
    await refreshInBackground();
  } else {
    // Pre-fill memory cache from storage
    const stored = await getFromStorage();
    if (stored.length > 0) memoryCache = stored;
  }
}

async function refreshInBackground(): Promise<void> {
  const fresh = await fetchFromApi();
  if (fresh.length > 0) {
    memoryCache = fresh;
    await saveToStorage(fresh);
  }
}

/**
 * Force refresh — returns fresh data.
 */
export async function forceRefreshEmployees(): Promise<CachedEmployee[]> {
  const fresh = await fetchFromApi();
  if (fresh.length > 0) {
    memoryCache = fresh;
    await saveToStorage(fresh);
  }
  return fresh.length > 0 ? fresh : memoryCache ?? [];
}

/**
 * Clear cache on logout.
 */
export async function clearEmployeeCache(): Promise<void> {
  memoryCache = null;
  try {
    await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
  } catch {
    // ignore
  }
}
