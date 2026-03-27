import axios from 'axios';
import Constants from 'expo-constants';
import { VersionCheckResult } from '../types/version';
import { config } from './config';

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
export function stringOrNull(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, string>;
    return obj.ar ?? obj.en ?? Object.values(obj)[0] ?? null;
  }
  return String(value);
}

const TRUSTED_DOMAINS = ['ruqaqa.sa', 'play.google.com', 'apps.apple.com'];

/**
 * Check if a hostname belongs to a trusted domain.
 * Matches exact domain or subdomains (e.g. "www.ruqaqa.sa" matches "ruqaqa.sa").
 */
function isTrustedDomain(hostname: string): boolean {
  return TRUSTED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

/**
 * Normalize download URLs — handle malformed URLs from the backend.
 * Only allows URLs on trusted domains. Returns undefined for untrusted domains.
 */
export function normalizeDownloadUrl(url: unknown): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  let normalized = url.trim();
  if (!normalized) return undefined;
  // Ensure protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  // Validate domain
  try {
    const parsed = new URL(normalized);
    if (!isTrustedDomain(parsed.hostname)) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return normalized;
}

