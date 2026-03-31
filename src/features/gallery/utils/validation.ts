import { ALBUM_TITLE_MAX_LENGTH, AlbumFilters } from '../types';

// Control characters regex (C0 + C1 ranges, excluding common whitespace)
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

// Regex metacharacters to strip from search input
const REGEX_META_RE = /[.*+?^${}()|[\]\\]/g;

export function validateAlbumName(
  name: string,
): { valid: boolean; error?: string } {
  const cleaned = name.replace(CONTROL_CHARS_RE, '').trim();

  if (cleaned.length === 0) {
    return { valid: false, error: 'Album name is required' };
  }

  if (cleaned.length > ALBUM_TITLE_MAX_LENGTH) {
    return { valid: false, error: `Album name must be ${ALBUM_TITLE_MAX_LENGTH} characters or less` };
  }

  return { valid: true };
}

export function sanitizeAlbumSearch(query: string): string {
  return query.trim().replace(REGEX_META_RE, '').slice(0, 200);
}

export function hasActiveAlbumFilters(filters: AlbumFilters): boolean {
  return filters.search.trim().length > 0;
}
