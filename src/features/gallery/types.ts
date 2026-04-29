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

// --- Phase 6A: Upload types & constants ---

/** Maximum number of images that can be selected for upload. */
export const MAX_IMAGES = 20;

/** Maximum number of videos that can be selected (1 only). */
export const MAX_VIDEO = 1;

/** Maximum file size per item in bytes (100 MB). */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** Maximum concurrent upload slots in the pipeline. */
export const MAX_CONCURRENT_UPLOADS = 3;

/** Maximum retry attempts per failed upload. */
export const MAX_UPLOAD_RETRIES = 2;

/** Pipeline progress weights for images. */
export const IMAGE_WEIGHT = 1.0;
export const IMAGE_OPTIMIZE_WEIGHT = 0.20;
export const IMAGE_WATERMARK_WEIGHT = 0.10;
export const IMAGE_UPLOAD_WEIGHT = 0.75;

/** Pipeline progress weights for video. */
export const VIDEO_WEIGHT = 4.0;
export const VIDEO_OPTIMIZE_WEIGHT = 1.5;
export const VIDEO_WATERMARK_WEIGHT = 1.3;
export const VIDEO_UPLOAD_WEIGHT = 1.2;

/**
 * Stages an individual item goes through in the upload pipeline.
 * Mirrors Flutter's `ItemState` enum from `upload_pipeline.dart`.
 */
export type ItemState =
  | 'waiting'
  | 'hashing'
  | 'checkingDuplicate'
  | 'optimizing'
  | 'checkingSize'
  | 'watermarking'
  | 'uploading'
  | 'done'
  | 'skipped'
  | 'failed'
  | 'sizeExceeded';

/**
 * Per-item status in the pipeline.
 * Mirrors Flutter's `PipelineItemStatus`.
 */
export interface PipelineItemStatus {
  filename: string;
  state: ItemState;
  actualSizeBytes?: number;
  originalSizeBytes?: number;
  /** Video compression progress (0–1). Only set during 'optimizing' state for videos. */
  progressPercent?: number;
}

/**
 * Overall pipeline progress snapshot.
 * Mirrors Flutter's `PipelineStatus`.
 */
export interface PipelineStatus {
  progress: number; // 0.0 – 1.0
  completedCount: number;
  failedCount: number;
  totalCount: number;
  items: readonly PipelineItemStatus[];
}

/**
 * Final result after pipeline completes.
 * Mirrors Flutter's `PipelineResult`.
 */
export interface PipelineResult {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  oversizedCount: number;
  totalCount: number;
  bytesSaved: number;
}

/**
 * Watermark positioning draft for a single media item.
 * All values are percentages (0–100). Mirrors Flutter's `WatermarkDraft`.
 */
export interface WatermarkDraft {
  xPct: number;
  yPct: number;
  widthPct: number;
  opacityPct: number;
  noWatermarkNeeded: boolean;
}

export const DEFAULT_WATERMARK_DRAFT: WatermarkDraft = {
  xPct: 40,
  yPct: 40,
  widthPct: 20,
  opacityPct: 30,
  noWatermarkNeeded: false,
};

/**
 * Clamp a WatermarkDraft to valid ranges. Used at trust boundaries:
 * API responses, AsyncStorage reads, before FFmpeg command construction.
 */
export function clampWatermarkDraft(draft: Partial<WatermarkDraft>): WatermarkDraft {
  const clamp = (val: unknown, min: number, max: number, fallback: number): number => {
    if (typeof val !== 'number' || !isFinite(val)) return fallback;
    return Math.min(max, Math.max(min, val));
  };
  return {
    xPct: clamp(draft.xPct, 0, 100, DEFAULT_WATERMARK_DRAFT.xPct),
    yPct: clamp(draft.yPct, 0, 100, DEFAULT_WATERMARK_DRAFT.yPct),
    widthPct: clamp(draft.widthPct, 5, 80, DEFAULT_WATERMARK_DRAFT.widthPct),
    opacityPct: clamp(draft.opacityPct, 10, 100, DEFAULT_WATERMARK_DRAFT.opacityPct),
    noWatermarkNeeded: typeof draft.noWatermarkNeeded === 'boolean'
      ? draft.noWatermarkNeeded
      : false,
  };
}

/**
 * Media item representation for the watermark editor.
 * Separate from ImagePickerAsset to decouple editor from picker.
 */
export interface EditorMediaItem {
  /** Unique ID (assetId from picker, or URI as fallback). */
  id: string;
  /** Full-resolution image URI or video thumbnail URI for editor preview. */
  uri: string;
  /** Media type. */
  type: 'image' | 'video';
  /** Optional smaller thumbnail URI for the strip. */
  thumbnailUri?: string;
}

/** Stages of the upload screen state machine. */
export type UploadStage = 'idle' | 'processing' | 'done' | 'error';

/** A generic picker item (tag, project) with id and display label. */
export interface PickerItem {
  id: string;
  name: string;
}

/**
 * Error codes that may come back from `DELETE /tags/{id}` as a 409 response.
 * Every code the UI understands is whitelisted here; unknown codes are never
 * passed up from the service layer.
 */
export type DeleteTagErrorCode =
  | 'TAG_ONLY_ON_ITEMS'
  | 'TAG_DETACH_CONFLICT'
  | 'TAG_RACE_CONFLICT'
  | 'TAG_HAS_TOO_MANY_REFERENCES';

/** Result of `galleryService.deleteTag`. Discriminated union. */
export type DeleteTagResult =
  | { success: true; detachedFromItemCount: number }
  | {
      success: false;
      code: 'TAG_ONLY_ON_ITEMS';
      /** ObjectIds of items that would become tagless. Validated + capped at 50. */
      itemIds: string[];
      /** Count reported by the server (may exceed itemIds.length when capped). */
      count: number;
    }
  | { success: false; code: 'TAG_DETACH_CONFLICT'; itemId: string }
  | { success: false; code: 'TAG_RACE_CONFLICT' }
  | {
      success: false;
      code: 'TAG_HAS_TOO_MANY_REFERENCES';
      affectedItemCount: number;
    };

/** Result of `galleryService.renameTag`. Discriminated union. */
export type RenameTagResult =
  | { success: true; tag: PickerItem }
  | { success: false; code: 'TAG_NAME_TAKEN' };

/** Decision when a duplicate is detected during upload. */
export type DuplicateDecision = 'addToAlbums' | 'skip';

/**
 * Hash check result from `GET /gallery/check-hash`.
 * Mirrors Flutter's `CheckHashResult`.
 */
export interface CheckHashResult {
  exists: boolean;
  hash: string;
  item?: CheckHashItem;
}

export interface CheckHashItem {
  id: string;
  filename?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  createdAt?: string;
  project?: CheckHashRelation;
  tags: CheckHashRelation[];
  albums: CheckHashAlbum[];
}

export interface CheckHashRelation {
  id: string;
  name: string;
}

export interface CheckHashAlbum {
  id: string;
  title: string;
  isDefault: boolean;
}

/**
 * Result from `POST /gallery/{id}/albums`.
 * Mirrors Flutter's `AddToAlbumsResult`.
 */
export interface AddToAlbumsResult {
  success: boolean;
  itemId: string;
  addedAlbumIds: string[];
  alreadyLinkedAlbumIds: string[];
  removedFromDefault: boolean;
}

/** Outcome of a single item upload attempt. */
export type UploadItemOutcome = 'success' | 'duplicate' | 'failure' | 'fileTooLarge';

/**
 * Result from uploading a single item.
 * Mirrors Flutter's `UploadItemResult`.
 */
export interface UploadItemResult {
  outcome: UploadItemOutcome;
  item?: MediaItem;
  duplicateInfo?: CheckHashResult;
}

/**
 * Info passed to the duplicate decision callback.
 * Mirrors Flutter's `DuplicateInfo`.
 */
export interface DuplicateInfo {
  filename: string;
  checkResult: CheckHashResult;
}
