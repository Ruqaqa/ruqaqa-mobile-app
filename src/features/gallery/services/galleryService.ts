import { apiClient, uploadMultipart } from '@/services/apiClient';
import { ApiError, mapAxiosError } from '@/services/errors';
import { isValidObjectId } from '@/utils/sanitize';
import {
  GalleryAlbum, ALBUM_PAGE_SIZE, FetchAlbumMediaResult, MEDIA_PAGE_SIZE,
  MediaItemDetail, ManageItemPayload, PickerItem,
  CheckHashResult, CheckHashItem, CheckHashRelation, CheckHashAlbum,
  AddToAlbumsResult, TAG_NAME_MAX_LENGTH,
  UploadItemResult, WatermarkDraft, MediaItem,
} from '../types';
import { parseAlbum, parseMediaItem, parseMediaItemDetail, extractLocalizedString } from '../utils/parsers';

// ---------------------------------------------------------------------------
// Phase 6A: Input sanitization for upload-related service functions
// ---------------------------------------------------------------------------

/** Max length for search queries sent to tag/project search endpoints. */
const SEARCH_QUERY_MAX_LENGTH = 200;

/** Max length for project names during inline creation. */
const PROJECT_NAME_MAX_LENGTH = 200;

// Control characters regex (C0 + C1 ranges, excluding common whitespace)
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

// Regex metacharacters to strip from search input (prevents regex injection on backend)
const REGEX_META_RE = /[.*+?^${}()|[\]\\]/g;

/** SHA-256 hex hash format. */
const SHA256_HEX_RE = /^[a-f\d]{64}$/i;

/**
 * Sanitize a search query: strip control chars, regex metacharacters,
 * trim, and cap length.
 */
function sanitizeSearchQuery(query: string): string {
  return query
    .replace(CONTROL_CHARS_RE, '')
    .replace(REGEX_META_RE, '')
    .trim()
    .slice(0, SEARCH_QUERY_MAX_LENGTH);
}

/**
 * Sanitize a name for inline creation (tag or project):
 * strip control chars, trim, cap length.
 */
function sanitizeCreateName(name: string, maxLength: number): string {
  return name.replace(CONTROL_CHARS_RE, '').trim().slice(0, maxLength);
}

interface FetchAlbumsParams {
  search?: string;
}

interface FetchAlbumsResult {
  albums: GalleryAlbum[];
}

export async function fetchAlbums(
  params: FetchAlbumsParams,
): Promise<FetchAlbumsResult> {
  const queryParams: Record<string, any> = {
    limit: ALBUM_PAGE_SIZE,
    sort: '-createdAt',
  };

  if (params.search) {
    queryParams.search = params.search;
  }

  try {
    const response = await apiClient.get('/gallery/albums', { params: queryParams });
    const docs: unknown[] = response.data.docs ?? [];

    const albums = docs
      .map((doc) => parseAlbum(doc as Record<string, any>))
      // Sort default albums first
      .sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
      });

    return { albums };
  } catch (error) {
    throw mapAxiosError(error);
  }
}

export async function createAlbum(
  title: string,
  locale: 'ar' | 'en',
): Promise<GalleryAlbum> {
  try {
    const response = await apiClient.post('/gallery/albums', { title, locale });
    return parseAlbum(response.data);
  } catch (error) {
    throw mapAxiosError(error);
  }
}

export async function updateAlbumTitle(
  albumId: string,
  title: string,
  locale: 'ar' | 'en',
): Promise<boolean> {
  if (!isValidObjectId(albumId) || !albumId) {
    throw new ApiError('UNKNOWN', 'Invalid album ID');
  }

  try {
    await apiClient.patch('/gallery/albums', { id: albumId, title, locale });
    return true;
  } catch (error) {
    throw mapAxiosError(error);
  }
}

interface FetchAlbumMediaParams {
  albumId: string;
  page: number;
}

export async function fetchAlbumMedia(
  params: FetchAlbumMediaParams,
): Promise<FetchAlbumMediaResult> {
  if (!isValidObjectId(params.albumId)) {
    throw new ApiError('UNKNOWN', 'Invalid album ID');
  }

  const queryParams: Record<string, any> = {
    album: params.albumId,
    page: params.page,
    limit: MEDIA_PAGE_SIZE,
    sort: '-createdAt',
  };

  try {
    const response = await apiClient.get('/gallery', { params: queryParams });
    const docs: unknown[] = response.data.docs ?? [];

    const items = docs
      .map((doc) => parseMediaItem(doc as Record<string, any>))
      .filter((item) => item.id.length > 0);

    return {
      items,
      pagination: {
        page: response.data.page ?? 1,
        totalDocs: response.data.totalDocs ?? 0,
        totalPages: response.data.totalPages ?? 0,
        hasNextPage: response.data.hasNextPage ?? false,
        hasPrevPage: response.data.hasPrevPage ?? false,
      },
    };
  } catch (error) {
    throw mapAxiosError(error);
  }
}

// --- Phase 5C: Single-item operations for bulk orchestration ---

export async function deleteMediaItem(itemId: string): Promise<boolean> {
  if (!isValidObjectId(itemId) || !itemId) {
    throw new ApiError('UNKNOWN', 'Invalid item ID');
  }

  try {
    await apiClient.delete(`/gallery/${itemId}`);
    return true;
  } catch (error) {
    throw mapAxiosError(error);
  }
}

export async function fetchMediaItemDetail(itemId: string): Promise<MediaItemDetail> {
  if (!isValidObjectId(itemId) || !itemId) {
    throw new ApiError('UNKNOWN', 'Invalid item ID');
  }

  try {
    const response = await apiClient.get(`/gallery/${itemId}`);
    return parseMediaItemDetail(response.data);
  } catch (error) {
    throw mapAxiosError(error);
  }
}

export async function manageMediaItem(
  itemId: string,
  payload: ManageItemPayload,
): Promise<boolean> {
  if (!isValidObjectId(itemId) || !itemId) {
    throw new ApiError('UNKNOWN', 'Invalid item ID');
  }

  const body: Record<string, any> = {};
  if (payload.tagIds !== undefined) body.tags = payload.tagIds;
  if (payload.albumIds !== undefined) body.albums = payload.albumIds;
  if (payload.noWatermarkNeeded !== undefined) {
    body.noWatermarkNeeded = payload.noWatermarkNeeded;
    body.alreadyWatermarked = payload.noWatermarkNeeded;
  }

  try {
    await apiClient.patch(`/gallery/${itemId}`, body);
    return true;
  } catch (error) {
    throw mapAxiosError(error);
  }
}

// --- Phase 6A: Tag, Project, and Upload service extensions ---

/**
 * Fetch tags with optional search. Used by the tag picker in upload screen.
 * Mirrors Flutter's `fetchTagSuggestions` from `suggestions_service.dart`.
 */
export async function fetchTags(query: string): Promise<PickerItem[]> {
  const sanitized = sanitizeSearchQuery(query);
  const limit = sanitized ? 50 : 30;
  try {
    const response = await apiClient.get('/tags', {
      params: { q: sanitized, limit },
    });
    if (response.data?.success && Array.isArray(response.data.tags)) {
      return response.data.tags.map((t: any) => ({
        id: String(t.id ?? ''),
        name: String(t.name ?? ''),
      }));
    }
  } catch {
    // swallow — return empty
  }
  return [];
}

/**
 * Create a new tag. Used by inline tag creation in the upload screen.
 * Mirrors Flutter's `GalleryApiService.createTag`.
 */
export async function createTag(
  name: string,
  locale: 'ar' | 'en',
): Promise<PickerItem | null> {
  const sanitized = sanitizeCreateName(name, TAG_NAME_MAX_LENGTH);
  if (sanitized.length === 0) return null;
  try {
    const response = await apiClient.post('/tags', { name: sanitized, locale });
    const data = response.data;
    if (data && data.id) {
      return {
        id: String(data.id),
        name: String(data.name ?? name),
      };
    }
  } catch {
    // swallow — return null
  }
  return null;
}

/**
 * Fetch projects with optional search. Used by the project picker in upload screen.
 * Mirrors Flutter's `fetchProjectSuggestions` from `suggestions_service.dart`.
 */
export async function fetchProjects(query: string): Promise<PickerItem[]> {
  const sanitized = sanitizeSearchQuery(query);
  const limit = sanitized ? 10 : 7;
  try {
    const response = await apiClient.get('/projects', {
      params: { q: sanitized, limit },
    });
    if (response.data?.success && Array.isArray(response.data.projects)) {
      return response.data.projects.map((p: any) => ({
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
      }));
    }
  } catch {
    // swallow — return empty
  }
  return [];
}

/**
 * Create a new project. Used by inline project creation in the upload screen.
 * Mirrors Flutter's `GalleryApiService.createProject`.
 */
export async function createProject(
  name: string,
  clientName?: string,
  clientId?: string,
): Promise<PickerItem | null> {
  const sanitized = sanitizeCreateName(name, PROJECT_NAME_MAX_LENGTH);
  if (sanitized.length === 0) return null;
  try {
    const body: Record<string, string> = { name: sanitized };
    if (clientName) body.clientName = sanitizeCreateName(clientName, PROJECT_NAME_MAX_LENGTH);
    if (clientId && isValidObjectId(clientId)) body.clientId = clientId;

    const response = await apiClient.post('/projects', body);
    const data = response.data;
    if (data && data.id) {
      return {
        id: String(data.id),
        name: String(data.name ?? name),
      };
    }
  } catch {
    // swallow — return null
  }
  return null;
}

/**
 * Check if a file hash already exists on the server.
 * Mirrors Flutter's `GalleryApiService.checkHash`.
 */
export async function checkHash(hash: string): Promise<CheckHashResult | null> {
  // Validate hash format: must be a valid SHA-256 hex string (64 chars)
  if (!hash || !SHA256_HEX_RE.test(hash)) return null;

  try {
    const response = await apiClient.get('/gallery/check-hash', {
      params: { hash },
    });
    return parseCheckHashResult(response.data);
  } catch {
    return null;
  }
}

/**
 * Add an existing item to albums (used when duplicate is found and user chooses "Add to Albums").
 * Mirrors Flutter's `GalleryApiService.addItemToAlbums`.
 */
export async function addItemToAlbums(
  itemId: string,
  albumIds: string[],
  tagIds?: string[],
  projectId?: string,
): Promise<AddToAlbumsResult | null> {
  if (!isValidObjectId(itemId) || !itemId) return null;

  // Validate all IDs are valid ObjectId format
  const validAlbumIds = albumIds.filter((id) => id && isValidObjectId(id));
  if (validAlbumIds.length === 0) return null;

  const validTagIds = tagIds?.filter((id) => id && isValidObjectId(id));
  if (projectId && !isValidObjectId(projectId)) return null;

  try {
    const body: Record<string, any> = { albumIds: validAlbumIds };
    if (validTagIds && validTagIds.length > 0) body.tagIds = validTagIds;
    if (projectId) body.projectId = projectId;

    const response = await apiClient.post(`/gallery/${itemId}/albums`, body);
    const data = response.data;
    return {
      success: data?.success ?? false,
      itemId: String(data?.itemId ?? ''),
      addedAlbumIds: Array.isArray(data?.addedAlbumIds)
        ? data.addedAlbumIds.map(String)
        : [],
      alreadyLinkedAlbumIds: Array.isArray(data?.alreadyLinkedAlbumIds)
        ? data.alreadyLinkedAlbumIds.map(String)
        : [],
      removedFromDefault: data?.removedFromDefault ?? false,
    };
  } catch {
    return null;
  }
}

// --- Phase 6B: Upload item (multipart) ---

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Generate a privacy-safe filename: 13-char random base36 ID + extension.
 * Defense-in-depth: backend also generates its own canonical name.
 * Mirrors Flutter's `_privacySafeFilename`.
 */
function privacySafeFilename(uri: string): string {
  const lastDot = uri.lastIndexOf('.');
  // Extract extension, strip query params and path separators
  const rawExt = lastDot !== -1 ? uri.substring(lastDot).toLowerCase().split(/[?#]/)[0] : '';
  const ext = rawExt.replace(/[/\\\0]/g, '').slice(0, 10);
  let id = '';
  for (let i = 0; i < 13; i++) {
    id += BASE36[Math.floor(Math.random() * 36)];
  }
  return `${id}${ext}`;
}

export interface UploadItemParams {
  fileUri: string;
  alreadyOptimized?: boolean;
  noWatermarkNeeded?: boolean;
  albumIds?: string[];
  tagIds?: string[];
  projectId?: string;
  originalSourceHash?: string;
  watermarkDraft?: WatermarkDraft;
}

/**
 * Upload a single media item via multipart POST to `/gallery`.
 * Mirrors Flutter's `GalleryApiService.uploadItem`.
 *
 * Returns an `UploadItemResult` that distinguishes success, duplicate (409),
 * file-too-large (413), and generic failure.
 */
export async function uploadItem(params: UploadItemParams): Promise<UploadItemResult> {
  try {
    const formData = new FormData();

    // Primary file
    const filename = privacySafeFilename(params.fileUri);
    formData.append('file', {
      uri: params.fileUri,
      name: filename,
      type: 'application/octet-stream',
    } as any);

    if (params.alreadyOptimized) {
      formData.append('alreadyOptimized', 'true');
    }
    if (params.noWatermarkNeeded) {
      formData.append('noWatermarkNeeded', 'true');
      formData.append('alreadyWatermarked', 'true');
    }
    if (params.watermarkDraft) {
      formData.append('watermarkOverrides', JSON.stringify(params.watermarkDraft));
    }
    // Validate all IDs are ObjectId format before including in form data
    if (params.albumIds && params.albumIds.length > 0) {
      const validAlbumIds = params.albumIds.filter((id) => id && isValidObjectId(id));
      if (validAlbumIds.length > 0) {
        formData.append('albumIds', JSON.stringify(validAlbumIds));
      }
    }
    if (params.tagIds && params.tagIds.length > 0) {
      const validTagIds = params.tagIds.filter((id) => id && isValidObjectId(id));
      if (validTagIds.length > 0) {
        formData.append('tags', JSON.stringify(validTagIds));
      }
    }
    if (params.projectId && isValidObjectId(params.projectId)) {
      formData.append('project', params.projectId);
    }
    if (params.originalSourceHash && SHA256_HEX_RE.test(params.originalSourceHash)) {
      formData.append('originalSourceHash', params.originalSourceHash);
    }

    const response = await uploadMultipart('/gallery', formData);
    const data = response.data;

    return {
      outcome: 'success',
      item: data ? parseMediaItem(data) : undefined,
    };
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 413) {
      return { outcome: 'fileTooLarge' };
    }
    if (status === 409) {
      const dupData = error?.response?.data?.duplicate;
      return {
        outcome: 'duplicate',
        duplicateInfo: dupData ? parseCheckHashResult(dupData) : undefined,
      };
    }
    return { outcome: 'failure' };
  }
}

// --- Parsers for Phase 6A types ---

function parseCheckHashResult(data: any): CheckHashResult {
  return {
    exists: data?.exists ?? false,
    hash: String(data?.hash ?? ''),
    item: data?.item ? parseCheckHashItem(data.item) : undefined,
  };
}

function parseCheckHashItem(data: any): CheckHashItem {
  return {
    id: String(data?.id ?? ''),
    filename: data?.filename ?? undefined,
    mediaType: data?.mediaType ?? undefined,
    thumbnailUrl: data?.thumbnailUrl ?? undefined,
    createdAt: data?.createdAt ?? undefined,
    project: data?.project && typeof data.project === 'object'
      ? parseCheckHashRelation(data.project)
      : undefined,
    tags: Array.isArray(data?.tags)
      ? data.tags.filter((t: any) => t && t.id).map(parseCheckHashRelation)
      : [],
    albums: Array.isArray(data?.albums)
      ? data.albums.filter((a: any) => a && a.id).map(parseCheckHashAlbum)
      : [],
  };
}

function parseCheckHashRelation(data: any): CheckHashRelation {
  const localized = extractLocalizedString(data?.name ?? data?.title ?? '');
  return {
    id: String(data?.id ?? ''),
    name: localized.en || localized.ar,
  };
}

function parseCheckHashAlbum(data: any): CheckHashAlbum {
  const localized = extractLocalizedString(data?.title ?? '');
  return {
    id: String(data?.id ?? ''),
    title: localized.en || localized.ar,
    isDefault: data?.isDefault ?? false,
  };
}
