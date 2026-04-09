import {
  validateAlbumName,
  validateTagName,
  sanitizeAlbumSearch,
  hasActiveAlbumFilters,
  validateBulkIds,
} from '../utils/validation';
import {
  ALBUM_TITLE_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  AlbumFilters,
  EMPTY_ALBUM_FILTERS,
  MAX_BULK_SELECTION,
} from '../types';

describe('validateAlbumName', () => {
  it('accepts a valid album name', () => {
    const result = validateAlbumName('My Album');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects an empty string', () => {
    const result = validateAlbumName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects whitespace-only string', () => {
    const result = validateAlbumName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects name exceeding max length', () => {
    const longName = 'a'.repeat(ALBUM_TITLE_MAX_LENGTH + 1);
    const result = validateAlbumName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts name at exactly max length', () => {
    const maxName = 'a'.repeat(ALBUM_TITLE_MAX_LENGTH);
    const result = validateAlbumName(maxName);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('strips control characters and validates trimmed result', () => {
    const result = validateAlbumName('Album\x00Name');
    expect(result.valid).toBe(true);
  });

  it('rejects name that becomes empty after stripping control chars', () => {
    const result = validateAlbumName('\x00\x01\x02');
    expect(result.valid).toBe(false);
  });
});

describe('validateTagName', () => {
  it('accepts a valid tag name', () => {
    const result = validateTagName('nature');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects an empty string', () => {
    const result = validateTagName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects whitespace-only string', () => {
    const result = validateTagName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects name exceeding TAG_NAME_MAX_LENGTH', () => {
    const longName = 'a'.repeat(TAG_NAME_MAX_LENGTH + 1);
    const result = validateTagName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts name at exactly TAG_NAME_MAX_LENGTH', () => {
    const maxName = 'a'.repeat(TAG_NAME_MAX_LENGTH);
    const result = validateTagName(maxName);
    expect(result.valid).toBe(true);
  });

  it('strips control characters and validates trimmed result', () => {
    const result = validateTagName('tag\x00name');
    expect(result.valid).toBe(true);
  });

  it('rejects name that becomes empty after stripping control chars', () => {
    const result = validateTagName('\x00\x01\x02');
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeAlbumSearch', () => {
  it('trims whitespace', () => {
    expect(sanitizeAlbumSearch('  hello  ')).toBe('hello');
  });

  it('caps at 200 characters', () => {
    const longQuery = 'a'.repeat(300);
    expect(sanitizeAlbumSearch(longQuery)).toHaveLength(200);
  });

  it('strips regex metacharacters', () => {
    expect(sanitizeAlbumSearch('test.*+?^${}()|[]\\')).toBe('test');
  });

  it('preserves normal characters mixed with metacharacters', () => {
    expect(sanitizeAlbumSearch('hello (world)')).toBe('hello world');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeAlbumSearch('')).toBe('');
  });
});

describe('hasActiveAlbumFilters', () => {
  it('returns false for empty filters', () => {
    expect(hasActiveAlbumFilters(EMPTY_ALBUM_FILTERS)).toBe(false);
  });

  it('returns false for whitespace-only search', () => {
    expect(hasActiveAlbumFilters({ search: '   ' })).toBe(false);
  });

  it('returns true for non-empty search', () => {
    expect(hasActiveAlbumFilters({ search: 'photos' })).toBe(true);
  });
});

describe('validateBulkIds', () => {
  const VALID_ID_1 = '507f1f77bcf86cd799439011';
  const VALID_ID_2 = '507f1f77bcf86cd799439022';
  const VALID_ID_3 = '507f1f77bcf86cd799439033';

  it('rejects empty array', () => {
    const result = validateBulkIds([]);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects array exceeding max count', () => {
    const ids = Array.from({ length: MAX_BULK_SELECTION + 1 }, (_, i) =>
      `507f1f77bcf86cd7994390${String(i).padStart(2, '0')}`,
    );
    const result = validateBulkIds(ids);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(String(MAX_BULK_SELECTION));
  });

  it('deduplicates IDs and validates unique set', () => {
    const result = validateBulkIds([VALID_ID_1, VALID_ID_1, VALID_ID_2]);
    expect(result.valid).toBe(true);
    expect(result.ids).toEqual([VALID_ID_1, VALID_ID_2]);
  });

  it('rejects invalid ObjectId format', () => {
    const result = validateBulkIds([VALID_ID_1, 'bad-id!', VALID_ID_2]);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts valid array of ObjectIds', () => {
    const result = validateBulkIds([VALID_ID_1, VALID_ID_2, VALID_ID_3]);
    expect(result.valid).toBe(true);
    expect(result.ids).toEqual([VALID_ID_1, VALID_ID_2, VALID_ID_3]);
  });

  it('rejects empty string IDs', () => {
    const result = validateBulkIds(['', VALID_ID_1]);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts custom maxCount', () => {
    const result = validateBulkIds([VALID_ID_1, VALID_ID_2, VALID_ID_3], 2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2');
  });
});
