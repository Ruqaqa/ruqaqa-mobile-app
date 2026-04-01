import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { GalleryAlbum, MediaItem, MediaType } from '../types';

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

/**
 * Resolve mediaType from explicit field or fallback to mimeType.
 * Mirrors Flutter's `GalleryItem._resolveMediaType`.
 */
function resolveMediaType(raw: Record<string, any>): MediaType {
  const mediaType = raw.mediaType;
  if (mediaType === 'image' || mediaType === 'video') return mediaType;

  const mimeType = raw.mimeType;
  if (typeof mimeType === 'string' && mimeType.startsWith('video/')) return 'video';

  return 'image';
}

/**
 * Extract uploader info from a value that is either a plain string ID
 * or an object with id/name/firstName/lastName.
 * Mirrors Flutter's `GalleryItem._extractUploader`.
 */
function extractUploader(value: unknown): { id: string | null; name: string | null } {
  if (typeof value === 'string' && value.length > 0) {
    return { id: value, name: null };
  }
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const uid = String(obj.id ?? '');
    const name = obj.name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return { id: uid || null, name: name.trim() };
    }
    const first = typeof obj.firstName === 'string' ? obj.firstName : '';
    const last = typeof obj.lastName === 'string' ? obj.lastName : '';
    const full = `${first} ${last}`.trim();
    return { id: uid || null, name: full || null };
  }
  return { id: null, name: null };
}

/**
 * Parse a raw API response object into a typed MediaItem.
 * Mirrors Flutter's `GalleryItem.fromJson`.
 */
export function parseMediaItem(raw: Record<string, any>): MediaItem {
  const id = String(raw.id ?? '');

  // Resolve thumbnail URL with fallback logic
  const rawThumbnailUrl = raw.thumbnailUrl as string | null | undefined;
  const thumbnailFilename = raw.thumbnailFilename as string | null | undefined;
  const fallbackThumbnailUrl =
    thumbnailFilename && thumbnailFilename.length > 0 && id.length > 0
      ? `/api/mobile/gallery/media/${id}?thumb=true`
      : null;
  const resolvedThumbnailUrl = normalizeMediaUrl(rawThumbnailUrl ?? fallbackThumbnailUrl);

  const uploader = extractUploader(raw.uploadedBy);

  return {
    id,
    filename: typeof raw.filename === 'string' ? raw.filename : null,
    mediaType: resolveMediaType(raw),
    thumbnailUrl: resolvedThumbnailUrl,
    noWatermarkNeeded: raw.noWatermarkNeeded === true || raw.alreadyWatermarked === true,
    watermarkedVariantAvailable: (raw.watermarkedVariantAvailable as boolean) ?? true,
    uploadedById: uploader.id,
    uploadedByName: uploader.name,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
  };
}
