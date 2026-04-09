import MockAdapter from 'axios-mock-adapter';

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

jest.mock('@/utils/mediaUrl', () => ({
  normalizeMediaUrl: (url: string | null | undefined) =>
    url && typeof url === 'string' && url.length > 0 ? url : null,
}));

// eslint-disable-next-line import/first
import { apiClient } from '@/services/apiClient';
// eslint-disable-next-line import/first
import { ApiError } from '@/services/errors';
// eslint-disable-next-line import/first
import { deleteAlbum } from '../services/galleryService';

let mock: MockAdapter;

const VALID_ALBUM_ID = '507f1f77bcf86cd799439011';
const INVALID_ID = 'not-an-object-id';

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
});

afterEach(() => {
  mock.restore();
});

describe('deleteAlbum', () => {
  it('sends DELETE to /gallery/albums/{id} and returns true on 200', async () => {
    mock.onDelete(`/gallery/albums/${VALID_ALBUM_ID}`).reply(200, { success: true });

    const result = await deleteAlbum(VALID_ALBUM_ID);
    expect(result).toBe(true);
    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].url).toBe(`/gallery/albums/${VALID_ALBUM_ID}`);
  });

  it('rejects invalid albumId before making any request', async () => {
    await expect(deleteAlbum(INVALID_ID)).rejects.toThrow(ApiError);
    expect(mock.history.delete).toHaveLength(0);
  });

  it('rejects empty string albumId before making any request', async () => {
    await expect(deleteAlbum('')).rejects.toThrow(ApiError);
    expect(mock.history.delete).toHaveLength(0);
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onDelete(`/gallery/albums/${VALID_ALBUM_ID}`).reply(403);
    await expect(deleteAlbum(VALID_ALBUM_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws NOT_FOUND on 404', async () => {
    mock.onDelete(`/gallery/albums/${VALID_ALBUM_ID}`).reply(404);
    await expect(deleteAlbum(VALID_ALBUM_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws SERVER on 500', async () => {
    mock.onDelete(`/gallery/albums/${VALID_ALBUM_ID}`).reply(500);
    await expect(deleteAlbum(VALID_ALBUM_ID)).rejects.toMatchObject({
      code: 'SERVER',
    });
  });

  it('throws NETWORK on network error', async () => {
    mock.onDelete(`/gallery/albums/${VALID_ALBUM_ID}`).networkError();
    await expect(deleteAlbum(VALID_ALBUM_ID)).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('throws SERVER on 400 (default album protection from backend)', async () => {
    // The backend returns 400 when trying to delete the default album. This
    // lives in the route, not the service; the service just maps it to an
    // axios error. mapAxiosError treats any unmapped response status as SERVER.
    mock
      .onDelete(`/gallery/albums/${VALID_ALBUM_ID}`)
      .reply(400, { error: 'Cannot delete default album' });
    await expect(deleteAlbum(VALID_ALBUM_ID)).rejects.toMatchObject({
      code: 'SERVER',
    });
  });
});
