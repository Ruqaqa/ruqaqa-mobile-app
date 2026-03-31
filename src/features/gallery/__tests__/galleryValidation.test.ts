import {
  validateAlbumName,
  sanitizeAlbumSearch,
  hasActiveAlbumFilters,
} from '../utils/validation';
import { ALBUM_TITLE_MAX_LENGTH, AlbumFilters, EMPTY_ALBUM_FILTERS } from '../types';

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
