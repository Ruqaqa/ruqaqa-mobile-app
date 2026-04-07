/**
 * Tests for the shared convertSharedFilesToAttachments utility.
 *
 * This is the feature-agnostic version with an explicit maxAttachments
 * parameter, used by both transactions and reconciliation.
 */

import { convertSharedFilesToAttachments } from '../sharedFilesAdapter';
import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';

function makeSharedFile(overrides: Partial<SharedFile> = {}): SharedFile {
  return {
    uri: 'file:///data/photo.jpg',
    mimeType: 'image/jpeg',
    fileType: 'image',
    fileName: 'photo.jpg',
    fileSize: 1024,
    ...overrides,
  };
}

describe('convertSharedFilesToAttachments (shared)', () => {
  it('converts shared files to ReceiptAttachment format', () => {
    const shared = [makeSharedFile()];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      uri: 'file:///data/photo.jpg',
      type: 'image',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
    });
    expect(result.attachments[0].id).toBeDefined();
  });

  it('uses fallback name when fileName is null', () => {
    const shared = [makeSharedFile({ fileName: null, mimeType: 'image/jpeg' })];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments[0].name).toMatch(/^shared_\d+\.jpeg$/);
  });

  it('caps at maxAttachments when no existing attachments', () => {
    const shared = Array.from({ length: 6 }, (_, i) =>
      makeSharedFile({ uri: `file:///data/photo_${i}.jpg`, fileName: `photo_${i}.jpg` }),
    );
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments).toHaveLength(4);
    expect(result.overflow).toBe(2);
  });

  it('accounts for existing attachments when capping', () => {
    const shared = Array.from({ length: 3 }, (_, i) =>
      makeSharedFile({ uri: `file:///data/photo_${i}.jpg`, fileName: `photo_${i}.jpg` }),
    );
    const result = convertSharedFilesToAttachments(shared, 2, 4);
    expect(result.attachments).toHaveLength(2);
    expect(result.overflow).toBe(1);
  });

  it('returns zero overflow when within limits', () => {
    const shared = [makeSharedFile()];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.overflow).toBe(0);
  });

  it('returns empty array when already at max attachments', () => {
    const shared = [makeSharedFile()];
    const result = convertSharedFilesToAttachments(shared, 4, 4);
    expect(result.attachments).toHaveLength(0);
    expect(result.overflow).toBe(1);
  });

  it('converts PDF shared files to document type', () => {
    const shared = [makeSharedFile({
      mimeType: 'application/pdf',
      fileType: 'document',
      fileName: 'invoice.pdf',
    })];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments[0].type).toBe('document');
  });

  it('handles empty shared files array', () => {
    const result = convertSharedFilesToAttachments([], 0, 4);
    expect(result.attachments).toHaveLength(0);
    expect(result.overflow).toBe(0);
  });

  it('respects different maxAttachments values', () => {
    const shared = Array.from({ length: 5 }, (_, i) =>
      makeSharedFile({ uri: `file:///data/photo_${i}.jpg`, fileName: `photo_${i}.jpg` }),
    );
    const result = convertSharedFilesToAttachments(shared, 0, 10);
    expect(result.attachments).toHaveLength(5);
    expect(result.overflow).toBe(0);
  });

  it('filters out video files', () => {
    const shared = [
      makeSharedFile({ uri: 'file:///data/photo.jpg' }),
      makeSharedFile({
        uri: 'file:///data/video.mp4',
        mimeType: 'video/mp4',
        fileType: 'video',
        fileName: 'video.mp4',
      }),
      makeSharedFile({ uri: 'file:///data/photo2.jpg', fileName: 'photo2.jpg' }),
    ];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments.every((a) => a.mimeType !== 'video/mp4')).toBe(true);
  });

  it('returns zero overflow when only video files are shared', () => {
    const shared = [
      makeSharedFile({
        uri: 'file:///data/video.mp4',
        mimeType: 'video/mp4',
        fileType: 'video',
        fileName: 'video.mp4',
      }),
    ];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments).toHaveLength(0);
    expect(result.overflow).toBe(0);
  });

  it('filters out files exceeding 10 MB', () => {
    const shared = [
      makeSharedFile({ uri: 'file:///data/small.jpg', fileSize: 5 * 1024 * 1024 }),
      makeSharedFile({ uri: 'file:///data/huge.jpg', fileSize: 50 * 1024 * 1024, fileName: 'huge.jpg' }),
    ];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].uri).toBe('file:///data/small.jpg');
  });

  it('allows files with null fileSize through', () => {
    const shared = [makeSharedFile({ fileSize: null })];
    const result = convertSharedFilesToAttachments(shared, 0, 4);
    expect(result.attachments).toHaveLength(1);
  });
});
