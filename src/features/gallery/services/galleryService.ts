import { apiClient } from '@/services/apiClient';
import { ApiError, mapAxiosError } from '@/services/errors';
import { isValidObjectId } from '@/utils/sanitize';
import { GalleryAlbum, ALBUM_PAGE_SIZE } from '../types';
import { parseAlbum } from '../utils/parsers';

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
