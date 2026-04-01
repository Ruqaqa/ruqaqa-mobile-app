import { apiClient } from '@/services/apiClient';
import { ApiError, mapAxiosError } from '@/services/errors';
import { isValidObjectId } from '@/utils/sanitize';
import { GalleryAlbum, ALBUM_PAGE_SIZE, FetchAlbumMediaResult, MEDIA_PAGE_SIZE, MediaItemDetail, ManageItemPayload } from '../types';
import { parseAlbum, parseMediaItem, parseMediaItemDetail } from '../utils/parsers';

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
