/**
 * Tests for converting shared files into transaction form attachments.
 *
 * Verifies the integration point: shared files from the share intent system
 * are correctly mapped to ReceiptAttachment format and respect limits.
 */

import { convertSharedFilesToAttachments } from '../utils/sharedFilesAdapter';
import { MAX_ATTACHMENTS } from '../components/ReceiptPickerSection';
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

describe('convertSharedFilesToAttachments', () => {
  it('converts shared files to ReceiptAttachment format', () => {
    const shared = [makeSharedFile()];
    const result = convertSharedFilesToAttachments(shared, 0);
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
    const result = convertSharedFilesToAttachments(shared, 0);
    expect(result.attachments[0].name).toMatch(/^shared_\d+\.jpeg$/);
  });

  it('caps at MAX_ATTACHMENTS when no existing attachments', () => {
    const shared = Array.from({ length: 6 }, (_, i) =>
      makeSharedFile({ uri: `file:///data/photo_${i}.jpg`, fileName: `photo_${i}.jpg` }),
    );
    const result = convertSharedFilesToAttachments(shared, 0);
    expect(result.attachments).toHaveLength(MAX_ATTACHMENTS);
    expect(result.overflow).toBe(2);
  });

  it('accounts for existing attachments when capping', () => {
    const shared = Array.from({ length: 3 }, (_, i) =>
      makeSharedFile({ uri: `file:///data/photo_${i}.jpg`, fileName: `photo_${i}.jpg` }),
    );
    // 2 existing attachments + 3 shared = 5 total, but cap is 4
    const result = convertSharedFilesToAttachments(shared, 2);
    expect(result.attachments).toHaveLength(2); // only room for 2 more
    expect(result.overflow).toBe(1);
  });

  it('returns zero overflow when within limits', () => {
    const shared = [makeSharedFile()];
    const result = convertSharedFilesToAttachments(shared, 0);
    expect(result.overflow).toBe(0);
  });

  it('returns empty array when already at max attachments', () => {
    const shared = [makeSharedFile()];
    const result = convertSharedFilesToAttachments(shared, MAX_ATTACHMENTS);
    expect(result.attachments).toHaveLength(0);
    expect(result.overflow).toBe(1);
  });

  it('converts PDF shared files to document type', () => {
    const shared = [makeSharedFile({
      mimeType: 'application/pdf',
      fileType: 'document',
      fileName: 'invoice.pdf',
    })];
    const result = convertSharedFilesToAttachments(shared, 0);
    expect(result.attachments[0].type).toBe('document');
  });

  it('handles empty shared files array', () => {
    const result = convertSharedFilesToAttachments([], 0);
    expect(result.attachments).toHaveLength(0);
    expect(result.overflow).toBe(0);
  });
});
