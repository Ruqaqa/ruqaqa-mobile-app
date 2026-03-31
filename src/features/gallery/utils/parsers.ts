import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { GalleryAlbum } from '../types';

/**
 * Extract localized strings from a value that is either a plain string
 * or an `{ en, ar }` object. Mirrors Flutter's `_extractLocalizedTitles`.
 */
export function extractLocalizedString(
  value: unknown,
): { en: string; ar: string } {
  if (typeof value === 'string') {
    return { en: value, ar: value };
  }
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const en =
      typeof obj.en === 'string' && obj.en.trim() !== '' ? obj.en : '';
    const ar =
      typeof obj.ar === 'string' && obj.ar.trim() !== '' ? obj.ar : '';
    // Cross-fallback: if one locale is missing, use the other
    return {
      en: en || ar,
      ar: ar || en,
    };
  }
  return { en: '', ar: '' };
}

/**
 * Parse a raw API response object into a typed GalleryAlbum.
 * Mirrors Flutter's `GalleryAlbum.fromJson`.
 */
export function parseAlbum(raw: Record<string, any>): GalleryAlbum {
  const titles = extractLocalizedString(raw.title);
  const description = extractLocalizedString(raw.description);

  // Normalize cover thumbnails: filter valid strings, apply media URL normalization
  const rawThumbnails = raw.coverThumbnails;
  const coverThumbnails: string[] = Array.isArray(rawThumbnails)
    ? rawThumbnails
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .map((url) => normalizeMediaUrl(url))
        .filter((url): url is string => url !== null)
    : [];

  // itemCount: prefer explicit field, fall back to items array length
  const items = raw.items;
  const itemCount =
    typeof raw.itemCount === 'number'
      ? raw.itemCount
      : Array.isArray(items)
        ? items.length
        : 0;

  return {
    id: String(raw.id ?? ''),
    title: titles.en || titles.ar,
    titleEn: titles.en,
    titleAr: titles.ar,
    description: description.en || description.ar || undefined,
    isDefault: raw.isDefault === true,
    itemCount,
    coverThumbnails,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
  };
}
