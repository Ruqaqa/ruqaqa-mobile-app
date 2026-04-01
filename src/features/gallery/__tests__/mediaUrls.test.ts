import { getFullResMediaUrl } from '../utils/mediaUrls';

jest.mock('@/services/config', () => ({
  config: { apiBaseUrl: 'https://ruqaqa.sa' },
}));

describe('getFullResMediaUrl', () => {
  it('builds correct URL for valid ObjectId', () => {
    const url = getFullResMediaUrl('507f1f77bcf86cd799439011');
    expect(url).toBe('https://ruqaqa.sa/api/gallery/media/507f1f77bcf86cd799439011');
  });

  it('uses /api/gallery/media/ path, not /api/mobile/', () => {
    const url = getFullResMediaUrl('507f1f77bcf86cd799439011');
    expect(url).not.toContain('/api/mobile/');
    expect(url).toContain('/api/gallery/media/');
  });

  it('returns null for empty string', () => {
    expect(getFullResMediaUrl('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(getFullResMediaUrl('   ')).toBeNull();
  });

  it('returns null for invalid ObjectId format', () => {
    expect(getFullResMediaUrl('bad-id!')).toBeNull();
  });

  it('returns null for short non-ObjectId string', () => {
    expect(getFullResMediaUrl('abc')).toBeNull();
  });

  it('accepts a 24-char hex string (valid ObjectId)', () => {
    const url = getFullResMediaUrl('aabbccddee1122334455ff00');
    expect(url).toBe('https://ruqaqa.sa/api/gallery/media/aabbccddee1122334455ff00');
  });
});
