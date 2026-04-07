/**
 * Tests for share intent file validation — MIME type, file size, file name
 * sanitization, and batch validation of shared files.
 *
 * These are extracted as pure utility functions tested independently of
 * the service/store layers.
 */

import {
  validateMimeType,
  validateFileSize,
  validateSharedFiles,
  sanitizeFileName,
  resolveFileType,
  ALLOWED_SHARE_MIME_TYPES,
  MAX_SHARE_FILE_SIZE_BYTES,
  MAX_SHARE_FILE_COUNT,
} from '@/services/shareIntent/shareIntentValidation';

// ---------------------------------------------------------------------------
// validateMimeType
// ---------------------------------------------------------------------------

describe('validateMimeType', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'application/pdf',
  ])('accepts allowed type: %s', (mime) => {
    expect(validateMimeType(mime)).toBe(true);
  });

  it.each([
    'application/zip',
    'text/plain',
    'audio/mpeg',
    'application/json',
    'image/gif',
    'image/bmp',
  ])('rejects disallowed type: %s', (mime) => {
    expect(validateMimeType(mime)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateMimeType('')).toBe(false);
  });

  it('rejects undefined/null-like values', () => {
    expect(validateMimeType(undefined as any)).toBe(false);
    expect(validateMimeType(null as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateFileSize
// ---------------------------------------------------------------------------

describe('validateFileSize', () => {
  it('accepts files under 100MB', () => {
    expect(validateFileSize(50 * 1024 * 1024)).toBe(true);
  });

  it('accepts files exactly at 100MB', () => {
    expect(validateFileSize(100 * 1024 * 1024)).toBe(true);
  });

  it('rejects files over 100MB', () => {
    expect(validateFileSize(100 * 1024 * 1024 + 1)).toBe(false);
  });

  it('accepts zero-byte files', () => {
    expect(validateFileSize(0)).toBe(true);
  });

  it('accepts when size is undefined (unknown size)', () => {
    expect(validateFileSize(undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveFileType
// ---------------------------------------------------------------------------

describe('resolveFileType', () => {
  it('maps image MIME types to image', () => {
    expect(resolveFileType('image/jpeg')).toBe('image');
    expect(resolveFileType('image/png')).toBe('image');
    expect(resolveFileType('image/heic')).toBe('image');
    expect(resolveFileType('image/webp')).toBe('image');
  });

  it('maps video MIME types to video', () => {
    expect(resolveFileType('video/mp4')).toBe('video');
    expect(resolveFileType('video/quicktime')).toBe('video');
    expect(resolveFileType('video/x-matroska')).toBe('video');
  });

  it('maps application/pdf to document', () => {
    expect(resolveFileType('application/pdf')).toBe('document');
  });

  it('defaults unknown types to document', () => {
    expect(resolveFileType('text/plain')).toBe('document');
  });
});

// ---------------------------------------------------------------------------
// sanitizeFileName
// ---------------------------------------------------------------------------

describe('sanitizeFileName', () => {
  it('strips path separators and returns basename', () => {
    expect(sanitizeFileName('/data/files/photo.jpg')).toBe('photo.jpg');
  });

  it('strips backslash path separators', () => {
    expect(sanitizeFileName('C:\\Users\\test\\photo.jpg')).toBe('photo.jpg');
  });

  it('strips null bytes', () => {
    expect(sanitizeFileName('photo\0.jpg')).toBe('photo.jpg');
  });

  it('preserves normal filenames', () => {
    expect(sanitizeFileName('my_photo-2024.jpg')).toBe('my_photo-2024.jpg');
  });

  it('handles empty string', () => {
    expect(sanitizeFileName('')).toBe('shared_file');
  });

  it('strips angle brackets and other risky characters', () => {
    expect(sanitizeFileName('photo <script>.jpg')).toBe('photo script.jpg');
  });
});

// ---------------------------------------------------------------------------
// validateSharedFiles
// ---------------------------------------------------------------------------

describe('validateSharedFiles', () => {
  const validFile = {
    uri: 'file:///data/photo.jpg',
    mimeType: 'image/jpeg',
    fileName: 'photo.jpg',
    fileSize: 1024,
  };

  const largePdf = {
    uri: 'file:///data/big.pdf',
    mimeType: 'application/pdf',
    fileName: 'big.pdf',
    fileSize: 101 * 1024 * 1024,
  };

  const unsupportedFile = {
    uri: 'file:///data/archive.zip',
    mimeType: 'application/zip',
    fileName: 'archive.zip',
    fileSize: 5000,
  };

  it('returns all files as valid when they pass checks', () => {
    const result = validateSharedFiles([validFile]);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it('rejects files with unsupported MIME types', () => {
    const result = validateSharedFiles([unsupportedFile]);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBe('invalidFileType');
  });

  it('rejects files over 100MB', () => {
    const result = validateSharedFiles([largePdf]);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBe('fileTooLarge');
  });

  it('separates valid from rejected in a mixed batch', () => {
    const result = validateSharedFiles([validFile, largePdf, unsupportedFile]);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
  });

  it('caps at MAX_SHARE_FILE_COUNT (20) files total', () => {
    const files = Array.from({ length: 25 }, (_, i) => ({
      ...validFile,
      uri: `file:///data/photo_${i}.jpg`,
      fileName: `photo_${i}.jpg`,
    }));
    const result = validateSharedFiles(files);
    expect(result.valid).toHaveLength(MAX_SHARE_FILE_COUNT);
    expect(result.rejected).toHaveLength(5);
    expect(result.rejected[0].reason).toBe('tooManyFiles');
  });

  it('sanitizes file names in valid results', () => {
    const fileWithPath = {
      ...validFile,
      fileName: '/data/user/0/photo.jpg',
    };
    const result = validateSharedFiles([fileWithPath]);
    expect(result.valid[0].fileName).toBe('photo.jpg');
  });

  it('resolves fileType from MIME type', () => {
    const result = validateSharedFiles([
      validFile,
      { ...validFile, uri: 'file:///doc.pdf', mimeType: 'application/pdf', fileName: 'doc.pdf' },
      { ...validFile, uri: 'file:///clip.mp4', mimeType: 'video/mp4', fileName: 'clip.mp4' },
    ]);
    expect(result.valid[0].fileType).toBe('image');
    expect(result.valid[1].fileType).toBe('document');
    expect(result.valid[2].fileType).toBe('video');
  });

  it('returns empty arrays for empty input', () => {
    const result = validateSharedFiles([]);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Constants consistency with ReceiptPickerSection
// ---------------------------------------------------------------------------

describe('constants consistency', () => {
  it('max file size is 100MB for gallery video support', () => {
    expect(MAX_SHARE_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
  });

  it('allowed MIME types include all receipt picker types', () => {
    const expected = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'];
    for (const mime of expected) {
      expect(ALLOWED_SHARE_MIME_TYPES).toContain(mime);
    }
  });

  it('allowed MIME types include video types for gallery', () => {
    const videoTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
    for (const mime of videoTypes) {
      expect(ALLOWED_SHARE_MIME_TYPES).toContain(mime);
    }
  });

  it('allowed MIME types include image/heif', () => {
    expect(ALLOWED_SHARE_MIME_TYPES).toContain('image/heif');
  });

  it('max file count is 20', () => {
    expect(MAX_SHARE_FILE_COUNT).toBe(20);
  });
});
