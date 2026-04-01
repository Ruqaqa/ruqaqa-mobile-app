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

// --- Phase 5B: Media types ---

export type MediaType = 'image' | 'video';

export interface MediaItem {
  id: string;
  filename: string | null;
  mediaType: MediaType;
  thumbnailUrl: string | null;
  noWatermarkNeeded: boolean;
  watermarkedVariantAvailable: boolean;
  uploadedById: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

export interface FetchAlbumMediaResult {
  items: MediaItem[];
  pagination: GalleryPagination;
}

export const MEDIA_PAGE_SIZE = 20;

// --- Phase 5C: Multi-Select & Bulk Actions ---

export const MAX_BULK_SELECTION = 50;

export type BulkOutcome = 'allSucceeded' | 'partialFailure' | 'allFailed';

export interface BulkActionResult {
  outcome: BulkOutcome;
  succeededIds: string[];
  failedIds: string[];
}

export interface BulkActionProgress {
  completed: number;
  total: number;
}

/** Tri-state for a checkbox in the manage sheet. */
export type CheckState = 'checked' | 'unchecked' | 'mixed';

/** State for the manage bottom sheet: current tags/albums for selected items. */
export interface ManageSheetState {
  tags: { id: string; name: string; state: CheckState }[];
  albums: { id: string; title: string; state: CheckState }[];
}

/** Payload sent to the manage endpoint for a single item. */
export interface ManageItemPayload {
  tagIds?: string[];
  albumIds?: string[];
  noWatermarkNeeded?: boolean;
}

/** Extended media item detail (for manage sheet pre-fetch). */
export interface MediaItemDetail extends MediaItem {
  tags: { id: string; name: string }[];
  albums: { id: string; title: string }[];
}

// --- Phase 5D: Download types ---

export type DownloadFormat = 'original' | 'watermarked';

export type DownloadStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface DownloadJob {
  id: string;
  sourceUrl: string;
  destinationUri: string;
  displayFilename: string;
  status: DownloadStatus;
  progress: number; // 0.0 – 1.0
  error?: string;
}

export interface DownloadSnapshot {
  jobs: DownloadJob[];
  totalCount: number;
  completedCount: number;
  failedCount: number;
  isActive: boolean;
  batchProgress: number; // 0.0 – 1.0
}

export const EMPTY_DOWNLOAD_SNAPSHOT: DownloadSnapshot = {
  jobs: [],
  totalCount: 0,
  completedCount: 0,
  failedCount: 0,
  isActive: false,
  batchProgress: 0,
};

export const MAX_CONCURRENT_DOWNLOADS = 2;
