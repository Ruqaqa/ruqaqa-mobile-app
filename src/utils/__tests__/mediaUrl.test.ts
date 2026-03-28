/**
 * Tests for normalizeMediaUrl — URL normalization with trusted domain validation.
 */

// Mock config to avoid expo-constants dependency
jest.mock('../../services/config', () => ({
  config: {
    apiBaseUrl: 'https://ruqaqa.sa',
  },
}));

import { normalizeMediaUrl, isTrustedDomain } from '../mediaUrl';

describe('isTrustedDomain', () => {
  it('accepts exact match', () => {
    expect(isTrustedDomain('ruqaqa.sa')).toBe(true);
  });

  it('accepts subdomain', () => {
    expect(isTrustedDomain('auth.ruqaqa.sa')).toBe(true);
    expect(isTrustedDomain('cdn.media.ruqaqa.sa')).toBe(true);
  });

  it('rejects unrelated domain', () => {
    expect(isTrustedDomain('evil.com')).toBe(false);
  });

  it('rejects suffix-match that is not a subdomain', () => {
    expect(isTrustedDomain('notruqaqa.sa')).toBe(false);
  });

  it('rejects domain that wraps trusted name as subdomain prefix', () => {
    expect(isTrustedDomain('ruqaqa.sa.evil.com')).toBe(false);
  });
});

describe('normalizeMediaUrl', () => {
  // --- null / empty ---

  it('returns null for null', () => {
    expect(normalizeMediaUrl(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeMediaUrl(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeMediaUrl('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(normalizeMediaUrl('   ')).toBeNull();
  });

  // --- absolute URLs ---

  it('returns trusted absolute https URL as-is', () => {
    const url = 'https://ruqaqa.sa/media/photo.jpg';
    expect(normalizeMediaUrl(url)).toBe(url);
  });

  it('returns trusted subdomain URL as-is', () => {
    const url = 'https://cdn.ruqaqa.sa/images/avatar.png';
    expect(normalizeMediaUrl(url)).toBe(url);
  });

  it('rejects untrusted absolute URL', () => {
    expect(normalizeMediaUrl('https://evil.com/malicious.jpg')).toBeNull();
  });

  it('rejects non-http scheme', () => {
    expect(normalizeMediaUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects data: URI', () => {
    expect(normalizeMediaUrl('data:image/png;base64,abc')).toBeNull();
  });

  it('rejects malformed URL', () => {
    expect(normalizeMediaUrl('https://')).toBeNull();
  });

  it('rejects ftp: scheme', () => {
    expect(normalizeMediaUrl('ftp://ruqaqa.sa/photo.jpg')).toBeNull();
  });

  it('rejects custom scheme', () => {
    expect(normalizeMediaUrl('myapp+custom://callback')).toBeNull();
  });

  it('rejects file: scheme (local file read)', () => {
    expect(normalizeMediaUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeMediaUrl('file:///data/data/sa.ruqaqa.finance/shared_prefs/auth.xml')).toBeNull();
  });

  it('rejects content: scheme (Android content provider)', () => {
    expect(normalizeMediaUrl('content://contacts/photo/1')).toBeNull();
  });

  it('rejects blob: scheme', () => {
    expect(normalizeMediaUrl('blob:https://ruqaqa.sa/some-uuid')).toBeNull();
  });

  it('rejects URL with embedded credentials', () => {
    // Credentials in URL can leak via Referer headers or server logs
    expect(normalizeMediaUrl('https://admin:password@ruqaqa.sa/photo.jpg')).toBeNull();
  });

  it('returns trusted absolute http URL (not just https)', () => {
    expect(normalizeMediaUrl('http://ruqaqa.sa/photo.jpg')).toBe(
      'http://ruqaqa.sa/photo.jpg',
    );
  });

  it('trims whitespace from absolute URL before validating', () => {
    expect(normalizeMediaUrl('  https://ruqaqa.sa/photo.jpg  ')).toBe(
      'https://ruqaqa.sa/photo.jpg',
    );
  });

  it('rejects absolute URL to private IP', () => {
    expect(normalizeMediaUrl('http://192.168.1.1:3000/photo.jpg')).toBeNull();
  });

  // --- relative paths ---

  it('resolves relative path with leading slash', () => {
    expect(normalizeMediaUrl('/api/media/file/123')).toBe(
      'https://ruqaqa.sa/api/media/file/123',
    );
  });

  it('resolves relative path without leading slash', () => {
    expect(normalizeMediaUrl('api/media/file/123')).toBe(
      'https://ruqaqa.sa/api/media/file/123',
    );
  });

  it('remaps legacy /media/ path to /api/media/file/', () => {
    expect(normalizeMediaUrl('/media/photos/avatar.jpg')).toBe(
      'https://ruqaqa.sa/api/media/file/photos/avatar.jpg',
    );
  });

  it('does not double-remap /api/media/ path', () => {
    expect(normalizeMediaUrl('/api/media/file/123')).toBe(
      'https://ruqaqa.sa/api/media/file/123',
    );
  });

  it('trims whitespace before processing', () => {
    expect(normalizeMediaUrl('  /media/photo.jpg  ')).toBe(
      'https://ruqaqa.sa/api/media/file/photo.jpg',
    );
  });
});
