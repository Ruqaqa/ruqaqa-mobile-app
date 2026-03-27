import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VersionCheckResult } from '../types/auth';
import { config } from './config';

const HAS_LAUNCHED_KEY = 'has_launched_before';

/**
 * Check app version against the backend.
 * Returns null if the check fails (non-blocking).
 */
export async function checkAppVersion(): Promise<VersionCheckResult | null> {
  try {
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const res = await axios.get<VersionCheckResult>(
      `${config.apiBaseUrl}/api/mobile/version-check`,
      {
        params: { version, _ts: Date.now() },
        timeout: 10_000,
      },
    );
    return normalizeVersionResult(res.data);
  } catch {
    return null;
  }
}

function normalizeVersionResult(data: any): VersionCheckResult {
  return {
    maintenanceMode: Boolean(data.maintenanceMode),
    maintenanceMessage: stringOrNull(data.maintenanceMessage) ?? undefined,
    updateRequired: Boolean(data.updateRequired),
    updateAvailable: Boolean(data.updateAvailable),
    downloadUrl: normalizeDownloadUrl(data.downloadUrl),
    updateTitle: stringOrNull(data.updateTitle) ?? undefined,
    updateMessage: stringOrNull(data.updateMessage) ?? undefined,
    releaseNotes: stringOrNull(data.releaseNotes) ?? undefined,
  };
}

/**
 * Handle backend returning localized Map objects instead of strings.
 * Extracts 'ar' value as default, falls back to first value or raw string.
 */
function stringOrNull(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, string>;
    return obj.ar ?? obj.en ?? Object.values(obj)[0] ?? null;
  }
  return String(value);
}

/**
 * Normalize download URLs — handle malformed URLs from the backend.
 */
function normalizeDownloadUrl(url: unknown): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  let normalized = url.trim();
  if (!normalized) return undefined;
  // Ensure protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

/**
 * Check if this is the first app launch.
 */
export async function isFirstLaunch(): Promise<boolean> {
  const launched = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
  return launched !== 'true';
}

/**
 * Mark that the app has been launched before.
 */
export async function markLaunched(): Promise<void> {
  await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
}
