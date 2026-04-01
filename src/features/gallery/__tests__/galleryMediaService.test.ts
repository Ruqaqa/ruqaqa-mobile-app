import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';
import { fetchAlbumMedia } from '../services/galleryService';

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

jest.mock('@/utils/mediaUrl', () => ({
  normalizeMediaUrl: (url: string | null | undefined) =>
    url && typeof url === 'string' && url.length > 0 ? url : null,
}));

// Valid MongoDB ObjectIds for testing
const ALBUM_ID = '507f1f77bcf86cd799439011';
const ALBUM_ID_2 = '507f1f77bcf86cd799439022';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
});

afterEach(() => {
  mock.restore();
});

const mockMediaItemRaw = {
  id: 'media-1',
  filename: 'photo-001.jpg',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  thumbnailUrl: '/api/mobile/gallery/media/media-1?thumb=true',
  thumbnailFilename: 'photo-001-thumb.jpg',
  mediaUrl: null,
  noWatermarkNeeded: false,
  watermarkedVariantAvailable: true,
  uploadedBy: { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali' },
  createdAt: '2025-06-01T00:00:00Z',
  filesize: 250000,
  width: 1200,
  height: 800,
};

const mockVideoItemRaw = {
  id: 'media-2',
  filename: 'video-001.mp4',
  mediaType: 'video',
  mimeType: 'video/mp4',
  thumbnailUrl: '/api/mobile/gallery/media/media-2?thumb=true',
  thumbnailFilename: 'video-001-thumb.jpg',
  mediaUrl: null,
  noWatermarkNeeded: true,
  watermarkedVariantAvailable: false,
  uploadedBy: 'emp-2',
  createdAt: '2025-06-02T00:00:00Z',
  filesize: 5000000,
  width: 1920,
  height: 1080,
};

describe('fetchAlbumMedia', () => {
  it('sends correct query params with albumId, page, limit, and sort', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [mockMediaItemRaw],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    const params = mock.history.get[0].params;
    expect(params.album).toBe(ALBUM_ID);
    expect(params.page).toBe(1);
    expect(params.limit).toBe(20);
    expect(params.sort).toBe('-createdAt');
  });

  it('sends custom page number', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 3,
      hasNextPage: false,
    });

    await fetchAlbumMedia({ albumId: ALBUM_ID, page: 3 });

    expect(mock.history.get[0].params.page).toBe(3);
  });

  it('returns parsed media items on success', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [mockMediaItemRaw, mockVideoItemRaw],
      totalDocs: 2,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('media-1');
    expect(result.items[0].mediaType).toBe('image');
    expect(result.items[0].filename).toBe('photo-001.jpg');
    expect(result.items[1].id).toBe('media-2');
    expect(result.items[1].mediaType).toBe('video');
  });

  it('returns pagination metadata', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [mockMediaItemRaw],
      totalDocs: 40,
      totalPages: 2,
      page: 1,
      hasNextPage: true,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.pagination.totalDocs).toBe(40);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.hasNextPage).toBe(true);
  });

  it('returns empty items array for empty album', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID_2, page: 1 });

    expect(result.items).toHaveLength(0);
    expect(result.pagination.totalDocs).toBe(0);
    expect(result.pagination.hasNextPage).toBe(false);
  });

  it('parses uploadedBy when it is an object with firstName/lastName', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [mockMediaItemRaw],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });
    const item = result.items[0];

    expect(item.uploadedById).toBe('emp-1');
    expect(item.uploadedByName).toBe('Ahmed Ali');
  });

  it('parses uploadedBy when it is a plain string ID', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [mockVideoItemRaw],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });
    const item = result.items[0];

    expect(item.uploadedById).toBe('emp-2');
    expect(item.uploadedByName).toBeNull();
  });

  it('resolves mediaType from mimeType when mediaType field is missing', async () => {
    const itemWithoutMediaType = {
      ...mockMediaItemRaw,
      id: 'media-3',
      mediaType: undefined,
      mimeType: 'video/mp4',
    };

    mock.onGet('/gallery').reply(200, {
      docs: [itemWithoutMediaType],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items[0].mediaType).toBe('video');
  });

  it('defaults mediaType to image when both mediaType and mimeType are missing', async () => {
    const itemWithNoType = {
      ...mockMediaItemRaw,
      id: 'media-4',
      mediaType: undefined,
      mimeType: undefined,
    };

    mock.onGet('/gallery').reply(200, {
      docs: [itemWithNoType],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items[0].mediaType).toBe('image');
  });

  it('builds thumbnail fallback URL when thumbnailUrl is missing but thumbnailFilename exists', async () => {
    const itemWithFallbackThumb = {
      ...mockMediaItemRaw,
      id: 'media-5',
      thumbnailUrl: null,
      thumbnailFilename: 'photo-005-thumb.jpg',
    };

    mock.onGet('/gallery').reply(200, {
      docs: [itemWithFallbackThumb],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items[0].thumbnailUrl).toContain('/api/mobile/gallery/media/media-5');
    expect(result.items[0].thumbnailUrl).toContain('thumb=true');
  });

  it('returns null thumbnailUrl when both thumbnailUrl and thumbnailFilename are missing', async () => {
    const itemNoThumb = {
      ...mockMediaItemRaw,
      id: 'media-6',
      thumbnailUrl: null,
      thumbnailFilename: null,
    };

    mock.onGet('/gallery').reply(200, {
      docs: [itemNoThumb],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items[0].thumbnailUrl).toBeNull();
  });

  it('parses noWatermarkNeeded and watermarkedVariantAvailable flags', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: [mockMediaItemRaw, mockVideoItemRaw],
      totalDocs: 2,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items[0].noWatermarkNeeded).toBe(false);
    expect(result.items[0].watermarkedVariantAvailable).toBe(true);
    expect(result.items[1].noWatermarkNeeded).toBe(true);
    expect(result.items[1].watermarkedVariantAvailable).toBe(false);
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onGet('/gallery').reply(403);

    await expect(fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 })).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws NOT_FOUND on 404', async () => {
    mock.onGet('/gallery').reply(404);

    await expect(fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 })).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  it('throws SERVER on 500', async () => {
    mock.onGet('/gallery').reply(500);

    await expect(fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 })).rejects.toThrow(
      expect.objectContaining({ code: 'SERVER' }),
    );
  });

  it('throws NETWORK on network error', async () => {
    mock.onGet('/gallery').networkError();

    await expect(fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 })).rejects.toThrow(
      expect.objectContaining({ code: 'NETWORK' }),
    );
  });

  it('handles docs array being null gracefully', async () => {
    mock.onGet('/gallery').reply(200, {
      docs: null,
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items).toHaveLength(0);
  });

  it('rejects invalid albumId before making API call', async () => {
    await expect(
      fetchAlbumMedia({ albumId: 'bad-id!', page: 1 }),
    ).rejects.toThrow(expect.objectContaining({ code: 'UNKNOWN' }));

    expect(mock.history.get).toHaveLength(0);
  });

  it('filters out items with empty IDs', async () => {
    const itemWithEmptyId = { ...mockMediaItemRaw, id: '' };

    mock.onGet('/gallery').reply(200, {
      docs: [mockMediaItemRaw, itemWithEmptyId],
      totalDocs: 2,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbumMedia({ albumId: ALBUM_ID, page: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('media-1');
  });
});
