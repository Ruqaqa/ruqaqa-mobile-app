import { config } from '@/services/config';

/**
 * Strict ObjectId check: exactly 24 hex characters.
 * Unlike the sanitize utility's isValidObjectId (which allows empty for optional filters),
 * this rejects empty strings since a media URL always needs a real ID.
 */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Build the full-resolution media URL for a gallery item.
 *
 * The media file endpoint is at /api/gallery/media/:id — NOT under /api/mobile/.
 * This is used by the full-screen viewer and video player for streaming.
 *
 * Returns null for empty, whitespace-only, or invalid IDs.
 */
export function getFullResMediaUrl(itemId: string): string | null {
  const trimmed = itemId?.trim();
  if (!trimmed || !OBJECT_ID_RE.test(trimmed)) return null;
  return `${config.apiBaseUrl}/api/gallery/media/${trimmed}`;
}
