import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';
import {
  fetchTags,
  createTag,
  fetchProjects,
  createProject,
  checkHash,
  addItemToAlbums,
} from '../services/galleryService';

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

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

// --- fetchTags ---

describe('fetchTags', () => {
  it('returns parsed tags on success', async () => {
    mock.onGet('/tags').reply(200, {
      success: true,
      tags: [
        { id: 'tag-1', name: 'Nature' },
        { id: 'tag-2', name: 'Architecture' },
      ],
    });

    const result = await fetchTags('');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'tag-1', name: 'Nature' });
    expect(result[1]).toEqual({ id: 'tag-2', name: 'Architecture' });
  });

  it('sends limit=30 when query is empty', async () => {
    mock.onGet('/tags').reply(200, { success: true, tags: [] });

    await fetchTags('');

    expect(mock.history.get[0].params).toEqual({ q: '', limit: 30 });
  });

  it('sends limit=50 when query is non-empty', async () => {
    mock.onGet('/tags').reply(200, { success: true, tags: [] });

    await fetchTags('nature');

    expect(mock.history.get[0].params).toEqual({ q: 'nature', limit: 50 });
  });

  it('returns empty array when success is false', async () => {
    mock.onGet('/tags').reply(200, { success: false });

    const result = await fetchTags('');

    expect(result).toEqual([]);
  });

  it('returns empty array when tags is not an array', async () => {
    mock.onGet('/tags').reply(200, { success: true, tags: 'invalid' });

    const result = await fetchTags('');

    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mock.onGet('/tags').networkError();

    const result = await fetchTags('');

    expect(result).toEqual([]);
  });

  it('returns empty array on 500', async () => {
    mock.onGet('/tags').reply(500);

    const result = await fetchTags('');

    expect(result).toEqual([]);
  });

  it('coerces id and name to strings', async () => {
    mock.onGet('/tags').reply(200, {
      success: true,
      tags: [{ id: 123, name: null }],
    });

    const result = await fetchTags('');

    expect(result[0]).toEqual({ id: '123', name: '' });
  });
});

// --- createTag ---

describe('createTag', () => {
  it('returns parsed tag on success', async () => {
    mock.onPost('/tags').reply(201, { id: 'tag-new', name: 'NewTag' });

    const result = await createTag('NewTag', 'en');

    expect(result).toEqual({ id: 'tag-new', name: 'NewTag' });
  });

  it('sends correct body with name and locale', async () => {
    mock.onPost('/tags').reply(201, { id: 'tag-1', name: 'Test' });

    await createTag('Test', 'ar');

    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toEqual({ name: 'Test', locale: 'ar' });
  });

  it('falls back to input name if response name is missing', async () => {
    mock.onPost('/tags').reply(201, { id: 'tag-1' });

    const result = await createTag('MyTag', 'en');

    expect(result).toEqual({ id: 'tag-1', name: 'MyTag' });
  });

  it('returns null when response has no id', async () => {
    mock.onPost('/tags').reply(200, { name: 'No ID' });

    const result = await createTag('No ID', 'en');

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mock.onPost('/tags').networkError();

    const result = await createTag('Test', 'en');

    expect(result).toBeNull();
  });

  it('returns null on 500', async () => {
    mock.onPost('/tags').reply(500);

    const result = await createTag('Test', 'en');

    expect(result).toBeNull();
  });
});

// --- fetchProjects ---

describe('fetchProjects', () => {
  it('returns parsed projects on success', async () => {
    mock.onGet('/projects').reply(200, {
      success: true,
      projects: [
        { id: 'proj-1', name: 'Project Alpha' },
        { id: 'proj-2', name: 'Project Beta' },
      ],
    });

    const result = await fetchProjects('');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'proj-1', name: 'Project Alpha' });
  });

  it('sends limit=7 when query is empty', async () => {
    mock.onGet('/projects').reply(200, { success: true, projects: [] });

    await fetchProjects('');

    expect(mock.history.get[0].params).toEqual({ q: '', limit: 7 });
  });

  it('sends limit=10 when query is non-empty', async () => {
    mock.onGet('/projects').reply(200, { success: true, projects: [] });

    await fetchProjects('alpha');

    expect(mock.history.get[0].params).toEqual({ q: 'alpha', limit: 10 });
  });

  it('returns empty array when success is false', async () => {
    mock.onGet('/projects').reply(200, { success: false });

    const result = await fetchProjects('');

    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mock.onGet('/projects').networkError();

    const result = await fetchProjects('');

    expect(result).toEqual([]);
  });

  it('returns empty array on 500', async () => {
    mock.onGet('/projects').reply(500);

    const result = await fetchProjects('');

    expect(result).toEqual([]);
  });
});

// --- createProject ---

describe('createProject', () => {
  it('returns parsed project on success', async () => {
    mock.onPost('/projects').reply(201, { id: 'proj-new', name: 'New Project' });

    const result = await createProject('New Project');

    expect(result).toEqual({ id: 'proj-new', name: 'New Project' });
  });

  it('sends name only when no client info', async () => {
    mock.onPost('/projects').reply(201, { id: 'p1', name: 'Test' });

    await createProject('Test');

    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toEqual({ name: 'Test' });
  });

  it('sends clientName and clientId when provided', async () => {
    mock.onPost('/projects').reply(201, { id: 'p1', name: 'Test' });

    await createProject('Test', 'Client Co', VALID_ID);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toEqual({ name: 'Test', clientName: 'Client Co', clientId: VALID_ID });
  });

  it('falls back to input name if response name is missing', async () => {
    mock.onPost('/projects').reply(201, { id: 'p1' });

    const result = await createProject('MyProject');

    expect(result).toEqual({ id: 'p1', name: 'MyProject' });
  });

  it('returns null when response has no id', async () => {
    mock.onPost('/projects').reply(200, { name: 'No ID' });

    const result = await createProject('No ID');

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mock.onPost('/projects').networkError();

    const result = await createProject('Test');

    expect(result).toBeNull();
  });

  it('returns null on 500', async () => {
    mock.onPost('/projects').reply(500);

    const result = await createProject('Test');

    expect(result).toBeNull();
  });
});

// --- checkHash ---

// Valid SHA-256 hex string (64 chars) for tests
const VALID_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('checkHash', () => {
  it('returns parsed result when hash does not exist', async () => {
    mock.onGet('/gallery/check-hash').reply(200, {
      exists: false,
      hash: VALID_HASH,
    });

    const result = await checkHash(VALID_HASH);

    expect(result).toEqual({ exists: false, hash: VALID_HASH, item: undefined });
  });

  it('returns parsed result with item when hash exists', async () => {
    mock.onGet('/gallery/check-hash').reply(200, {
      exists: true,
      hash: VALID_HASH,
      item: {
        id: 'item-1',
        filename: 'photo.jpg',
        mediaType: 'image',
        tags: [{ id: 'tag-1', name: 'Nature' }],
        albums: [{ id: 'album-1', title: 'My Album', isDefault: false }],
      },
    });

    const result = await checkHash(VALID_HASH);

    expect(result?.exists).toBe(true);
    expect(result?.item?.id).toBe('item-1');
    expect(result?.item?.tags).toHaveLength(1);
    expect(result?.item?.albums).toHaveLength(1);
  });

  it('sends hash as query param', async () => {
    mock.onGet('/gallery/check-hash').reply(200, { exists: false, hash: VALID_HASH });

    await checkHash(VALID_HASH);

    expect(mock.history.get[0].params).toEqual({ hash: VALID_HASH });
  });

  it('returns null for invalid hash format', async () => {
    const result = await checkHash('not-a-valid-sha256');

    expect(result).toBeNull();
    expect(mock.history.get).toHaveLength(0);
  });

  it('returns null on network error', async () => {
    mock.onGet('/gallery/check-hash').networkError();

    const result = await checkHash(VALID_HASH);

    expect(result).toBeNull();
  });

  it('returns null on 500', async () => {
    mock.onGet('/gallery/check-hash').reply(500);

    const result = await checkHash(VALID_HASH);

    expect(result).toBeNull();
  });
});

// --- addItemToAlbums ---

const VALID_ID = '507f1f77bcf86cd799439011';
const ALBUM_ID_1 = '507f1f77bcf86cd799439022';
const ALBUM_ID_2 = '507f1f77bcf86cd799439033';
const TAG_ID_1 = '507f1f77bcf86cd799439044';
const PROJECT_ID = '507f1f77bcf86cd799439055';

describe('addItemToAlbums', () => {
  it('returns parsed result on success', async () => {
    mock.onPost(`/gallery/${VALID_ID}/albums`).reply(200, {
      success: true,
      itemId: VALID_ID,
      addedAlbumIds: [ALBUM_ID_1],
      alreadyLinkedAlbumIds: [ALBUM_ID_2],
      removedFromDefault: true,
    });

    const result = await addItemToAlbums(VALID_ID, [ALBUM_ID_1, ALBUM_ID_2]);

    expect(result?.success).toBe(true);
    expect(result?.addedAlbumIds).toEqual([ALBUM_ID_1]);
    expect(result?.alreadyLinkedAlbumIds).toEqual([ALBUM_ID_2]);
    expect(result?.removedFromDefault).toBe(true);
  });

  it('sends albumIds, tagIds, and projectId in body', async () => {
    mock.onPost(`/gallery/${VALID_ID}/albums`).reply(200, {
      success: true,
      itemId: VALID_ID,
    });

    await addItemToAlbums(VALID_ID, [ALBUM_ID_1], [TAG_ID_1], PROJECT_ID);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.albumIds).toEqual([ALBUM_ID_1]);
    expect(body.tagIds).toEqual([TAG_ID_1]);
    expect(body.projectId).toBe(PROJECT_ID);
  });

  it('omits tagIds and projectId when not provided', async () => {
    mock.onPost(`/gallery/${VALID_ID}/albums`).reply(200, {
      success: true,
      itemId: VALID_ID,
    });

    await addItemToAlbums(VALID_ID, [ALBUM_ID_1]);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.albumIds).toEqual([ALBUM_ID_1]);
    expect(body.tagIds).toBeUndefined();
    expect(body.projectId).toBeUndefined();
  });

  it('returns null for invalid itemId', async () => {
    const result = await addItemToAlbums('bad-id!', [ALBUM_ID_1]);

    expect(result).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it('returns null when all album IDs are invalid', async () => {
    const result = await addItemToAlbums(VALID_ID, ['bad-id!', 'also-bad']);

    expect(result).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it('returns null on network error', async () => {
    mock.onPost(`/gallery/${VALID_ID}/albums`).networkError();

    const result = await addItemToAlbums(VALID_ID, [ALBUM_ID_1]);

    expect(result).toBeNull();
  });

  it('returns null on 500', async () => {
    mock.onPost(`/gallery/${VALID_ID}/albums`).reply(500);

    const result = await addItemToAlbums(VALID_ID, [ALBUM_ID_1]);

    expect(result).toBeNull();
  });
});
