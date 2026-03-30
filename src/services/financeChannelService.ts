import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';

export interface CachedFinanceChannel {
  id: string;
  name: string;
}

const CACHE_KEY = 'cached_finance_channels';
const CACHE_TIMESTAMP_KEY = 'cached_finance_channels_timestamp';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT = 10_000; // 10 seconds

let memoryCache: CachedFinanceChannel[] | null = null;

export async function getFinanceChannels(): Promise<CachedFinanceChannel[]> {
  // Return memory cache if available
  if (memoryCache) return memoryCache;

  // Try disk cache
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (cached && timestamp) {
      const channels = JSON.parse(cached);
      memoryCache = channels;

      // If not stale, return cached
      if (Date.now() - parseInt(timestamp) < CACHE_TTL) {
        return channels;
      }
      // If stale, return cached but refresh in background
      refreshChannels().catch(() => {});
      return channels;
    }
  } catch {}

  // No cache — fetch synchronously
  return refreshChannels();
}

async function refreshChannels(): Promise<CachedFinanceChannel[]> {
  try {
    const res = await apiClient.get<CachedFinanceChannel[]>('/finance-channels', {
      timeout: FETCH_TIMEOUT,
    });
    const channels = res.data;
    memoryCache = channels;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(channels));
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    return channels;
  } catch {
    // Return whatever we have (stale or empty)
    return memoryCache ?? [];
  }
}

export async function initializeFinanceChannelCache(): Promise<void> {
  await getFinanceChannels();
}

export function clearFinanceChannelCache(): void {
  memoryCache = null;
  AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIMESTAMP_KEY]).catch(() => {});
}
