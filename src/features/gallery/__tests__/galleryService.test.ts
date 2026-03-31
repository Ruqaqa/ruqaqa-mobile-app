import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';
import {
  fetchAlbums,
  createAlbum,
  updateAlbumTitle,
} from '../services/galleryService';

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

// Mock normalizeMediaUrl to return the input as-is for testing
jest.mock('@/utils/mediaUrl', () => ({
  normalizeMediaUrl: (url: string | null | undefined) =>
    url && typeof url === 'string' && url.length > 0 ? url : null,
}));

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
});

afterEach(() => {
  mock.restore();
});

const mockAlbumRaw = {
  id: 'album-1',
  title: { en: 'My Album', ar: 'ألبومي' },
  description: { en: 'A description', ar: 'وصف' },
  isDefault: false,
  itemCount: 5,
  coverThumbnails: ['/thumb1.jpg', '/thumb2.jpg'],
  createdAt: '2025-06-01T00:00:00Z',
};

const mockDefaultAlbumRaw = {
  id: 'album-default',
  title: { en: 'Default', ar: 'افتراضي' },
  isDefault: true,
  itemCount: 10,
  coverThumbnails: [],
  createdAt: '2025-01-01T00:00:00Z',
};

describe('fetchAlbums', () => {
  it('sends correct query params with limit=100 and sort=-createdAt', async () => {
    mock.onGet('/gallery/albums').reply(200, {
      docs: [mockAlbumRaw],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    await fetchAlbums({});

    const params = mock.history.get[0].params;
    expect(params.limit).toBe(100);
    expect(params.sort).toBe('-createdAt');
  });

  it('sends search param when provided', async () => {
    mock.onGet('/gallery/albums').reply(200, {
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
    });

    await fetchAlbums({ search: 'photos' });

    expect(mock.history.get[0].params.search).toBe('photos');
  });

  it('omits search param when empty', async () => {
    mock.onGet('/gallery/albums').reply(200, {
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
    });

    await fetchAlbums({});

    expect(mock.history.get[0].params.search).toBeUndefined();
  });

  it('returns parsed albums on success', async () => {
    mock.onGet('/gallery/albums').reply(200, {
      docs: [mockAlbumRaw],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbums({});

    expect(result.albums).toHaveLength(1);
    expect(result.albums[0].id).toBe('album-1');
    expect(result.albums[0].titleEn).toBe('My Album');
    expect(result.albums[0].titleAr).toBe('ألبومي');
    expect(result.albums[0].itemCount).toBe(5);
  });

  it('sorts default albums first', async () => {
    mock.onGet('/gallery/albums').reply(200, {
      docs: [mockAlbumRaw, mockDefaultAlbumRaw],
      totalDocs: 2,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbums({});

    expect(result.albums[0].isDefault).toBe(true);
    expect(result.albums[1].isDefault).toBe(false);
  });

  it('returns empty albums array for empty result', async () => {
    mock.onGet('/gallery/albums').reply(200, {
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbums({});

    expect(result.albums).toHaveLength(0);
  });

  it('computes itemCount from items array if itemCount not provided', async () => {
    const albumWithItems = {
      id: 'album-items',
      title: 'Test',
      items: ['item1', 'item2', 'item3'],
      isDefault: false,
      coverThumbnails: [],
      createdAt: '2025-01-01T00:00:00Z',
    };

    mock.onGet('/gallery/albums').reply(200, {
      docs: [albumWithItems],
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    });

    const result = await fetchAlbums({});

    expect(result.albums[0].itemCount).toBe(3);
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onGet('/gallery/albums').reply(403);

    await expect(fetchAlbums({})).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws NOT_FOUND on 404', async () => {
    mock.onGet('/gallery/albums').reply(404);

    await expect(fetchAlbums({})).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  it('throws SERVER on 500', async () => {
    mock.onGet('/gallery/albums').reply(500);

    await expect(fetchAlbums({})).rejects.toThrow(
      expect.objectContaining({ code: 'SERVER' }),
    );
  });

  it('throws NETWORK on network error', async () => {
    mock.onGet('/gallery/albums').networkError();

    await expect(fetchAlbums({})).rejects.toThrow(
      expect.objectContaining({ code: 'NETWORK' }),
    );
  });
});

describe('createAlbum', () => {
  it('sends POST with correct body and returns parsed album', async () => {
    mock.onPost('/gallery/albums').reply(201, mockAlbumRaw);

    const result = await createAlbum('My Album', 'en');

    expect(result.id).toBe('album-1');
    expect(result.titleEn).toBe('My Album');
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.title).toBe('My Album');
    expect(body.locale).toBe('en');
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onPost('/gallery/albums').reply(403);

    await expect(createAlbum('Test', 'ar')).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws SERVER on 500', async () => {
    mock.onPost('/gallery/albums').reply(500);

    await expect(createAlbum('Test', 'ar')).rejects.toThrow(
      expect.objectContaining({ code: 'SERVER' }),
    );
  });
});

describe('updateAlbumTitle', () => {
  it('sends PATCH with correct body and returns true', async () => {
    mock.onPatch('/gallery/albums').reply(200, { success: true });

    const result = await updateAlbumTitle('507f1f77bcf86cd799439011', 'New Title', 'en');

    expect(result).toBe(true);
    const body = JSON.parse(mock.history.patch[0].data);
    expect(body.id).toBe('507f1f77bcf86cd799439011');
    expect(body.title).toBe('New Title');
    expect(body.locale).toBe('en');
  });

  it('rejects invalid albumId', async () => {
    await expect(
      updateAlbumTitle('bad-id!', 'Title', 'en'),
    ).rejects.toThrow(expect.objectContaining({ code: 'UNKNOWN' }));

    expect(mock.history.patch).toHaveLength(0);
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onPatch('/gallery/albums').reply(403);

    await expect(
      updateAlbumTitle('507f1f77bcf86cd799439011', 'Title', 'en'),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
