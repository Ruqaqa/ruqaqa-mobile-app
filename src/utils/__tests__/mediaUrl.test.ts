/**
 * Tests for normalizeMediaUrl — URL normalization with scheme + credential validation.
 *
 * No domain allowlist: React Native <Image> cannot execute scripts or navigate,
 * so domain-gating provides no security benefit. Only scheme and credential checks matter.
 */

// Mock config to avoid expo-constants dependency
jest.mock('../../services/config', () => ({
  config: {
    apiBaseUrl: 'https://ruqaqa.sa',
  },
}));

import { normalizeMediaUrl } from '../mediaUrl';

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

  // --- absolute URLs (any http/https accepted) ---

  it('returns absolute https URL as-is', () => {
    const url = 'https://ruqaqa.sa/media/photo.jpg';
    expect(normalizeMediaUrl(url)).toBe(url);
  });

  it('returns subdomain URL as-is', () => {
    const url = 'https://cdn.ruqaqa.sa/images/avatar.png';
    expect(normalizeMediaUrl(url)).toBe(url);
  });

  it('accepts any http/https URL (no domain check)', () => {
    expect(normalizeMediaUrl('https://example.com/photo.jpg')).toBe(
      'https://example.com/photo.jpg',
    );
  });

  it('accepts private IP URLs (dev server)', () => {
    expect(normalizeMediaUrl('http://192.168.100.53:3000/photo.jpg')).toBe(
      'http://192.168.100.53:3000/photo.jpg',
    );
  });

  // --- scheme rejection ---

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
    expect(normalizeMediaUrl('file:///data/data/sa.ruqaqa.app/shared_prefs/auth.xml')).toBeNull();
  });

  it('rejects content: scheme (Android content provider)', () => {
    expect(normalizeMediaUrl('content://contacts/photo/1')).toBeNull();
  });

  it('rejects blob: scheme', () => {
    expect(normalizeMediaUrl('blob:https://ruqaqa.sa/some-uuid')).toBeNull();
  });

  // --- credential rejection ---

  it('rejects URL with embedded credentials', () => {
    expect(normalizeMediaUrl('https://admin:password@ruqaqa.sa/photo.jpg')).toBeNull();
  });

  // --- http variants ---

  it('returns absolute http URL (not just https)', () => {
    expect(normalizeMediaUrl('http://ruqaqa.sa/photo.jpg')).toBe(
      'http://ruqaqa.sa/photo.jpg',
    );
  });

  it('trims whitespace from absolute URL before validating', () => {
    expect(normalizeMediaUrl('  https://ruqaqa.sa/photo.jpg  ')).toBe(
      'https://ruqaqa.sa/photo.jpg',
    );
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
