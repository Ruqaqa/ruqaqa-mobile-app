import { config } from '../services/config';

/**
 * Trusted domains for media loading.
 * Only absolute URLs pointing to these domains (or subdomains) are allowed.
 */
const TRUSTED_MEDIA_DOMAINS = ['ruqaqa.sa'];

/**
 * Check whether a hostname belongs to a trusted domain.
 */
export function isTrustedDomain(hostname: string): boolean {
  return TRUSTED_MEDIA_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

/**
 * Normalize a media URL to an absolute, trusted URL.
 *
 * Handles:
 * - null/empty/whitespace -> null
 * - Already-absolute URLs -> validated against trusted domains, rejected if untrusted
 * - Relative paths -> resolved against `config.apiBaseUrl`
 * - Legacy `/media/...` paths -> remapped to `/api/media/file/...`
 * - Non-http(s) schemes -> rejected
 *
 * Mirrors the Flutter `_normalizeImageUrl` in `profile_avatar.dart`.
 */
export function normalizeMediaUrl(url: string | undefined | null): string | null {
  if (!url || !url.trim()) return null;

  const trimmed = url.trim();

  // Already absolute — validate scheme and domain
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      if (!isTrustedDomain(parsed.hostname)) return null;
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
