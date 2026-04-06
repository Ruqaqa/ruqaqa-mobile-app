import type { WatermarkDraft } from '../types';
import { DEFAULT_WATERMARK_DRAFT, clampWatermarkDraft } from '../types';

// ---------------------------------------------------------------------------
// URI / path validation
// ---------------------------------------------------------------------------

/**
 * Check whether a URI points to a local file (file:// scheme or absolute path).
 * Rejects http, https, content, data, and other non-local schemes.
 */
export function isLocalFileUri(uri: string): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('/');
}

/**
 * Characters that could break FFmpeg's command tokenizer or enable injection.
 * - `"` and `` ` ``: break quote boundaries in the tokenizer
 * - `$`: shell variable expansion (defense-in-depth; our native layer doesn't use a shell)
 * - `\0`: null byte — truncates C strings
 */
const UNSAFE_PATH_CHARS_RE = /["`$\0]/;

/**
 * Validate that a file path is safe for use in FFmpeg command construction
 * and other processing operations.
 *
 * Rejects:
 * - Empty/falsy paths
 * - Non-local URIs (http, content, data schemes)
 * - Paths containing characters that could break FFmpeg command parsing
 */
export function validateSafePath(path: string): boolean {
  if (!path) return false;
  if (!isLocalFileUri(path)) return false;
  if (UNSAFE_PATH_CHARS_RE.test(path)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// API response sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a raw API response from GET /gallery/watermark-settings into
 * a validated WatermarkDraft. Handles missing fields, wrong types, and
 * out-of-range values by falling back to defaults.
 *
 * The API returns `{ x, y, width, opacity }` (not the pct-suffixed names),
 * matching the format used by `watermarkSettingsService.ts`.
 *
 * Apply this at every trust boundary where watermark settings enter the app:
 * 1. API response parsing
 * 2. AsyncStorage reads
 * 3. Any external/untrusted JSON source
 */
export function sanitizeWatermarkSettings(
  raw: unknown,
): WatermarkDraft {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_WATERMARK_DRAFT };
  }

  const data = raw as Record<string, unknown>;

  return clampWatermarkDraft({
    xPct: typeof data.x === 'number' ? data.x : undefined,
    yPct: typeof data.y === 'number' ? data.y : undefined,
    widthPct: typeof data.width === 'number' ? data.width : undefined,
    opacityPct: typeof data.opacity === 'number' ? data.opacity : undefined,
    noWatermarkNeeded: typeof data.noWatermarkNeeded === 'boolean'
      ? data.noWatermarkNeeded
      : undefined,
  });
}
