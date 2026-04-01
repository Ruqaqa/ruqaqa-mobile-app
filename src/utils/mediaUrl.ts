import { config } from '../services/config';

/**
 * Normalize a media URL to an absolute URL safe for use in Image components.
 *
 * Handles:
 * - null/empty/whitespace -> null
 * - Already-absolute http(s) URLs -> accepted (scheme + credential validation only)
 * - Relative paths -> resolved against `config.apiBaseUrl`
 * - Legacy `/media/...` paths -> remapped to `/api/media/file/...`
 * - Non-http(s) schemes (javascript:, data:, file:, etc.) -> rejected
 * - URLs with embedded credentials -> rejected
 *
 * No domain allowlist: React Native's <Image> cannot execute scripts or
 * navigate, so domain-gating provides no meaningful security benefit.
 * Auth headers are attached explicitly by useAuthHeaders, not leaked via URL.
 * Mirrors Flutter's `_normalizeUrl` (which also has no domain check).
 */
export function normalizeMediaUrl(url: string | undefined | null): string | null {
  if (!url || !url.trim()) return null;

  const trimmed = url.trim();

  // Already absolute — validate scheme only
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      // Reject URLs with embedded credentials (leak via Referer/logs)
      if (parsed.username || parsed.password) return null;
      return trimmed;
    } catch {
      return null;
    }
  }

  // Reject non-http schemes (e.g. javascript:, data:, ftp:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null;

  // Relative path — ensure leading slash
  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // Remap legacy /media/... to /api/media/file/...
  if (path.startsWith('/media/') && !path.startsWith('/api/')) {
    path = `/api/media/file/${path.substring('/media/'.length)}`;
  }

  return `${config.apiBaseUrl}${path}`;
}
