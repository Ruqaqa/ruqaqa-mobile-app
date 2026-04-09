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
import { renameTag, deleteTag } from '../services/galleryService';

let mock: MockAdapter;

const VALID_TAG_ID = '507f1f77bcf86cd799439011';
const VALID_ITEM_ID_1 = '507f1f77bcf86cd799439021';
const VALID_ITEM_ID_2 = '507f1f77bcf86cd799439022';
const VALID_ITEM_ID_3 = '507f1f77bcf86cd799439023';
const INVALID_ID = 'not-an-object-id';

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
});

afterEach(() => {
  mock.restore();
});

// ---------------------------------------------------------------------------
// renameTag
// ---------------------------------------------------------------------------

describe('renameTag', () => {
  it('sends PATCH to /tags/{id} with sanitized name + locale and returns typed success', async () => {
    mock.onPatch(`/tags/${VALID_TAG_ID}`).reply(200, {
      id: VALID_TAG_ID,
      name: 'nature',
    });

    const result = await renameTag(VALID_TAG_ID, '  nature  ', 'en');

    expect(result).toEqual({
      success: true,
      tag: { id: VALID_TAG_ID, name: 'nature' },
    });

    const body = JSON.parse(mock.history.patch[0].data);
    expect(body.name).toBe('nature'); // trimmed/sanitized
    expect(body.locale).toBe('en');
  });

  it('rejects invalid tagId before making any request', async () => {
    await expect(renameTag(INVALID_ID, 'nature', 'en')).rejects.toThrow(ApiError);
    expect(mock.history.patch).toHaveLength(0);
  });

  it('throws on empty sanitized name (caller error)', async () => {
    await expect(renameTag(VALID_TAG_ID, '   ', 'en')).rejects.toThrow(ApiError);
    expect(mock.history.patch).toHaveLength(0);
  });

  it('returns TAG_NAME_TAKEN failure on 409 with that code', async () => {
    mock
      .onPatch(`/tags/${VALID_TAG_ID}`)
      .reply(409, { code: 'TAG_NAME_TAKEN', message: 'Name already exists' });

    const result = await renameTag(VALID_TAG_ID, 'nature', 'en');
    expect(result).toEqual({ success: false, code: 'TAG_NAME_TAKEN' });
  });

  it('throws on 409 with a different code', async () => {
    mock
      .onPatch(`/tags/${VALID_TAG_ID}`)
      .reply(409, { code: 'SOMETHING_ELSE' });

    await expect(renameTag(VALID_TAG_ID, 'nature', 'en')).rejects.toThrow(ApiError);
  });

  it('throws on 403', async () => {
    mock.onPatch(`/tags/${VALID_TAG_ID}`).reply(403);
    await expect(renameTag(VALID_TAG_ID, 'nature', 'en')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws on 404', async () => {
    mock.onPatch(`/tags/${VALID_TAG_ID}`).reply(404);
    await expect(renameTag(VALID_TAG_ID, 'nature', 'en')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws on 500', async () => {
    mock.onPatch(`/tags/${VALID_TAG_ID}`).reply(500);
    await expect(renameTag(VALID_TAG_ID, 'nature', 'en')).rejects.toMatchObject({
      code: 'SERVER',
    });
  });

  it('throws on server response missing id', async () => {
    mock.onPatch(`/tags/${VALID_TAG_ID}`).reply(200, {});
    await expect(renameTag(VALID_TAG_ID, 'nature', 'en')).rejects.toThrow(ApiError);
  });
});

// ---------------------------------------------------------------------------
// deleteTag — happy path + common errors
// ---------------------------------------------------------------------------

describe('deleteTag', () => {
  it('sends DELETE to /tags/{id} and returns typed success with detached count', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(200, { detachedFromItemCount: 5 });

    const result = await deleteTag(VALID_TAG_ID);

    expect(result).toEqual({ success: true, detachedFromItemCount: 5 });
  });

  it('defaults detachedFromItemCount to 0 when server omits it', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(200, {});
    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({ success: true, detachedFromItemCount: 0 });
  });

  it('rejects invalid tagId before making any request', async () => {
    await expect(deleteTag(INVALID_ID)).rejects.toThrow(ApiError);
    expect(mock.history.delete).toHaveLength(0);
  });

  it('throws on 403', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(403);
    await expect(deleteTag(VALID_TAG_ID)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws on 404', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(404);
    await expect(deleteTag(VALID_TAG_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws on 500', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(500);
    await expect(deleteTag(VALID_TAG_ID)).rejects.toMatchObject({ code: 'SERVER' });
  });
});

// ---------------------------------------------------------------------------
// deleteTag — 409 TAG_ONLY_ON_ITEMS
// ---------------------------------------------------------------------------

describe('deleteTag — TAG_ONLY_ON_ITEMS', () => {
  it('returns typed failure with validated itemIds + count', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, VALID_ITEM_ID_2],
      count: 2,
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, VALID_ITEM_ID_2],
      count: 2,
    });
  });

  it('filters out non-string itemIds', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, 123, null, VALID_ITEM_ID_2, undefined],
      count: 5,
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, VALID_ITEM_ID_2],
      count: 5, // server count preserved
    });
  });

  it('filters out invalid ObjectId strings', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, 'bad-id', '', VALID_ITEM_ID_2],
      count: 2,
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, VALID_ITEM_ID_2],
      count: 2,
    });
  });

  it('caps itemIds at 50 when server returns more', async () => {
    // Generate 200 valid ObjectIds
    const manyIds = Array.from({ length: 200 }, (_, i) =>
      '507f1f77bcf86cd79943' + i.toString().padStart(4, '0'),
    );
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: manyIds,
      count: 200,
    });

    const result = await deleteTag(VALID_TAG_ID);
    if (result.success !== false || result.code !== 'TAG_ONLY_ON_ITEMS') {
      throw new Error('Expected TAG_ONLY_ON_ITEMS failure');
    }
    expect(result.itemIds).toHaveLength(50);
    expect(result.count).toBe(200); // original count preserved
  });

  it('returns empty itemIds when server sends non-array', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: 'not-an-array',
      count: 3,
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [],
      count: 3,
    });
  });

  it('derives count from filtered itemIds when server omits count', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, VALID_ITEM_ID_2, VALID_ITEM_ID_3],
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_ONLY_ON_ITEMS',
      itemIds: [VALID_ITEM_ID_1, VALID_ITEM_ID_2, VALID_ITEM_ID_3],
      count: 3,
    });
  });
});

// ---------------------------------------------------------------------------
// deleteTag — 409 TAG_DETACH_CONFLICT
// ---------------------------------------------------------------------------

describe('deleteTag — TAG_DETACH_CONFLICT', () => {
  it('returns typed failure with valid itemId', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_DETACH_CONFLICT',
      itemId: VALID_ITEM_ID_1,
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_DETACH_CONFLICT',
      itemId: VALID_ITEM_ID_1,
    });
  });

  it('throws when itemId is missing', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_DETACH_CONFLICT',
    });

    await expect(deleteTag(VALID_TAG_ID)).rejects.toThrow(ApiError);
  });

  it('throws when itemId is not a valid ObjectId', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_DETACH_CONFLICT',
      itemId: 'not-an-id',
    });

    await expect(deleteTag(VALID_TAG_ID)).rejects.toThrow(ApiError);
  });

  it('throws when itemId is not a string', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_DETACH_CONFLICT',
      itemId: 12345,
    });

    await expect(deleteTag(VALID_TAG_ID)).rejects.toThrow(ApiError);
  });
});

// ---------------------------------------------------------------------------
// deleteTag — 409 TAG_RACE_CONFLICT
// ---------------------------------------------------------------------------

describe('deleteTag — TAG_RACE_CONFLICT', () => {
  it('returns typed failure with no additional data', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_RACE_CONFLICT',
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({ success: false, code: 'TAG_RACE_CONFLICT' });
  });
});

// ---------------------------------------------------------------------------
// deleteTag — 409 TAG_HAS_TOO_MANY_REFERENCES
// ---------------------------------------------------------------------------

describe('deleteTag — TAG_HAS_TOO_MANY_REFERENCES', () => {
  it('returns typed failure with affectedItemCount', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_HAS_TOO_MANY_REFERENCES',
      affectedItemCount: 1200,
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_HAS_TOO_MANY_REFERENCES',
      affectedItemCount: 1200,
    });
  });

  it('defaults affectedItemCount to 0 when missing', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'TAG_HAS_TOO_MANY_REFERENCES',
    });

    const result = await deleteTag(VALID_TAG_ID);
    expect(result).toEqual({
      success: false,
      code: 'TAG_HAS_TOO_MANY_REFERENCES',
      affectedItemCount: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// deleteTag — unknown and malformed 409 responses
// ---------------------------------------------------------------------------

describe('deleteTag — 409 unknown codes', () => {
  it('throws on 409 with an unknown code value', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {
      code: 'SOMETHING_WEIRD',
    });

    await expect(deleteTag(VALID_TAG_ID)).rejects.toThrow(ApiError);
  });

  it('throws on 409 with no code field', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409, {});
    await expect(deleteTag(VALID_TAG_ID)).rejects.toThrow(ApiError);
  });

  it('throws on 409 with empty body', async () => {
    mock.onDelete(`/tags/${VALID_TAG_ID}`).reply(409);
    await expect(deleteTag(VALID_TAG_ID)).rejects.toThrow(ApiError);
  });
});
