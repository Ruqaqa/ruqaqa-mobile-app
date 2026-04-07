/**
 * Tests for shareIntentValidation — MIME type, file size, and file type resolution.
 */

import {
  validateMimeType,
  validateFileSize,
  resolveFileType,
  MAX_SHARE_FILE_SIZE_BYTES,
} from '../shareIntentValidation';

describe('validateMimeType', () => {
  it('accepts image/jpeg', () => {
    expect(validateMimeType('image/jpeg')).toBe(true);
  });

  it('accepts image/png', () => {
    expect(validateMimeType('image/png')).toBe(true);
  });

  it('accepts image/heic', () => {
    expect(validateMimeType('image/heic')).toBe(true);
  });

  it('accepts image/heif', () => {
    expect(validateMimeType('image/heif')).toBe(true);
  });

  it('accepts image/webp', () => {
    expect(validateMimeType('image/webp')).toBe(true);
  });

  it('accepts video/mp4', () => {
    expect(validateMimeType('video/mp4')).toBe(true);
  });

  it('accepts video/quicktime', () => {
    expect(validateMimeType('video/quicktime')).toBe(true);
  });

  it('accepts video/x-matroska', () => {
    expect(validateMimeType('video/x-matroska')).toBe(true);
  });

  it('accepts application/pdf', () => {
    expect(validateMimeType('application/pdf')).toBe(true);
  });

  it('rejects application/zip', () => {
    expect(validateMimeType('application/zip')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateMimeType('')).toBe(false);
  });
});

describe('resolveFileType', () => {
  it('returns image for image MIME types', () => {
    expect(resolveFileType('image/jpeg')).toBe('image');
    expect(resolveFileType('image/png')).toBe('image');
    expect(resolveFileType('image/heic')).toBe('image');
  });

  it('returns video for video MIME types', () => {
    expect(resolveFileType('video/mp4')).toBe('video');
    expect(resolveFileType('video/quicktime')).toBe('video');
    expect(resolveFileType('video/x-matroska')).toBe('video');
  });

  it('returns document for non-image non-video MIME types', () => {
    expect(resolveFileType('application/pdf')).toBe('document');
  });
});

describe('validateFileSize', () => {
  it('accepts files within the 100 MB limit', () => {
    expect(validateFileSize(50 * 1024 * 1024)).toBe(true);
  });

  it('accepts files at exactly 100 MB', () => {
    expect(validateFileSize(100 * 1024 * 1024)).toBe(true);
  });

  it('rejects files above 100 MB', () => {
    expect(validateFileSize(101 * 1024 * 1024)).toBe(false);
  });

  it('accepts undefined size', () => {
    expect(validateFileSize(undefined)).toBe(true);
  });
});

describe('MAX_SHARE_FILE_SIZE_BYTES', () => {
  it('is 100 MB', () => {
    expect(MAX_SHARE_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
  });
});
