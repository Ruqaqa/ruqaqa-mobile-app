import { PAGE_SIZE } from '@/types/shared';
export { PAGE_SIZE };

export interface GalleryAlbum {
  id: string;
  title: string;        // resolved to current locale
  titleEn: string;
  titleAr: string;
  description?: string;
  isDefault: boolean;
  itemCount: number;
  coverThumbnails: string[];  // up to 4 thumbnail URLs
  createdAt: string;
}

export interface GalleryTag {
  id: string;
  name: string;
}

export interface GalleryPagination {
  page: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AlbumFilters {
  search: string;
}

export const EMPTY_ALBUM_FILTERS: AlbumFilters = { search: '' };
export const ALBUM_TITLE_MAX_LENGTH = 200;
export const TAG_NAME_MAX_LENGTH = 100;
export const MAX_COVER_THUMBNAILS = 4;
export const ALBUM_PAGE_SIZE = 100;  // Load all at once, matching Flutter

/** Resolve the display title for the current locale (mirrors Flutter's `localizedTitle`). */
export function getLocalizedTitle(album: GalleryAlbum, locale: string): string {
  return locale === 'ar'
    ? album.titleAr || album.titleEn
    : album.titleEn || album.titleAr;
}
