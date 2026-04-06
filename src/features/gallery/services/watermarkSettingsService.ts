import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/apiClient';
import type { WatermarkDraft } from '../types';
import { DEFAULT_WATERMARK_DRAFT, clampWatermarkDraft } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASYNC_STORAGE_KEY = 'gallery_watermark_settings';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let _cachedSettings: WatermarkDraft | null = null;
let _cachedAt: number | null = null;

function isCacheValid(): boolean {
  if (!_cachedSettings || _cachedAt === null) return false;
  return Date.now() - _cachedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch default watermark settings with a 3-tier fallback:
 * 1. In-memory cache (5-min TTL)
 * 2. API: GET /gallery/watermark-settings
 * 3. AsyncStorage last-used settings
 * 4. Hardcoded DEFAULT_WATERMARK_DRAFT
 *
 * All values are clamped to valid ranges at every trust boundary.
 */
export async function fetchWatermarkDefaults(): Promise<WatermarkDraft> {
  // 1. Check in-memory cache
  if (isCacheValid() && _cachedSettings) {
    return _cachedSettings;
  }

  // 2. Try API
  try {
    const response = await apiClient.get('/gallery/watermark-settings');
    if (response.status === 200 && response.data) {
      const apiData = response.data as Record<string, unknown>;
      const draft = clampWatermarkDraft({
        xPct: apiData.x as number | undefined,
        yPct: apiData.y as number | undefined,
        widthPct: apiData.width as number | undefined,
        opacityPct: apiData.opacity as number | undefined,
      });

      _cachedSettings = draft;
      _cachedAt = Date.now();

      // Persist for offline fallback (fire-and-forget)
      saveLastUsedSettings(draft).catch(() => { /* ignore */ });

      return draft;
    }
  } catch {
    // API failed — fall through to AsyncStorage
  }

  // 3. Try AsyncStorage
  const stored = await getLastUsedSettings();
  if (stored) {
    _cachedSettings = stored;
    _cachedAt = Date.now();
    return stored;
  }

  // 4. Hardcoded fallback
  return { ...DEFAULT_WATERMARK_DRAFT };
}

/**
 * Save the user's last-used watermark settings to AsyncStorage.
 * Called after a successful upload so the next session starts with
 * the user's preferred positioning.
 */
export async function saveLastUsedSettings(draft: WatermarkDraft): Promise<void> {
  try {
    const clamped = clampWatermarkDraft(draft);
    const json = JSON.stringify({
      x: clamped.xPct,
      y: clamped.yPct,
      width: clamped.widthPct,
      opacity: clamped.opacityPct,
    });
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, json);
  } catch {
    // AsyncStorage write failure is non-critical
  }
}

/**
 * Read the last-used watermark settings from AsyncStorage.
 * Returns null if no settings are stored or parsing fails.
 */
export async function getLastUsedSettings(): Promise<WatermarkDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return clampWatermarkDraft({
      xPct: parsed.x as number | undefined,
      yPct: parsed.y as number | undefined,
      widthPct: parsed.width as number | undefined,
      opacityPct: parsed.opacity as number | undefined,
    });
  } catch {
    return null;
  }
}

/**
 * Invalidate the in-memory cache. Forces a fresh API fetch on next call.
 */
export function invalidateCache(): void {
  _cachedSettings = null;
  _cachedAt = null;
}
