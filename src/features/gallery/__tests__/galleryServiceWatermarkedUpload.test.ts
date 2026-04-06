/**
 * Tests for dual-variant upload: watermarkedFileUri in uploadItem.
 * Verifies that when watermarkedFileUri is provided, it's appended as
 * 'watermarkedFile' in the multipart form data.
 */

// --- Mocks ---

const mockFileExists = jest.fn<boolean, []>().mockReturnValue(true);

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    get exists() { return mockFileExists(); },
  })),
}));

jest.mock('@/utils/mediaUrl', () => ({
  normalizeMediaUrl: (url: string | null | undefined) =>
    url && typeof url === 'string' && url.length > 0 ? url : null,
}));

// Track all FormData.append calls
const appendSpy = jest.fn();
const OriginalFormData = globalThis.FormData;

beforeAll(() => {
  // Replace FormData with a spy-aware version
  globalThis.FormData = class SpyFormData {
    private _data: Array<[string, any]> = [];
    append(key: string, value: any) {
      appendSpy(key, value);
      this._data.push([key, value]);
    }
  } as any;
});

afterAll(() => {
  globalThis.FormData = OriginalFormData;
});

// We need to capture the FormData that's sent to uploadMultipart
const mockUploadMultipart = jest.fn().mockResolvedValue({
  data: {
    id: 'item-1',
    filename: 'test.mp4',
    mediaType: 'video',
    noWatermarkNeeded: false,
    watermarkedVariantAvailable: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
});

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return {
    apiClient: mockAxios,
    uploadMultipart: (...args: any[]) => mockUploadMultipart(...args),
  };
});

import { uploadItem } from '../services/galleryService';

beforeEach(() => {
  jest.clearAllMocks();
  mockFileExists.mockReturnValue(true);
  mockUploadMultipart.mockResolvedValue({
    data: {
      id: 'item-1',
      filename: 'test.mp4',
      mediaType: 'video',
      noWatermarkNeeded: false,
      watermarkedVariantAvailable: true,
      createdAt: '2025-01-01T00:00:00Z',
    },
  });
});

describe('uploadItem with watermarkedFileUri', () => {
  it('appends watermarkedFile to form data when watermarkedFileUri is provided', async () => {
    await uploadItem({
      fileUri: 'file:///videos/compressed.mp4',
      watermarkedFileUri: 'file:///cache/watermarked.mp4',
      albumIds: ['507f1f77bcf86cd799439011'],
    });

    expect(mockUploadMultipart).toHaveBeenCalledTimes(1);

    // Check that FormData.append was called with 'watermarkedFile'
    const watermarkedCalls = appendSpy.mock.calls.filter(
      (call: any[]) => call[0] === 'watermarkedFile',
    );
    expect(watermarkedCalls).toHaveLength(1);

    const wmFileEntry = watermarkedCalls[0][1];
    expect(wmFileEntry.uri).toContain('watermarked.mp4');
    expect(wmFileEntry.type).toBe('video/mp4');
  });

  it('does NOT append watermarkedFile when watermarkedFileUri is absent', async () => {
    await uploadItem({
      fileUri: 'file:///videos/compressed.mp4',
      albumIds: ['507f1f77bcf86cd799439011'],
    });

    expect(mockUploadMultipart).toHaveBeenCalledTimes(1);
    const watermarkedCalls = appendSpy.mock.calls.filter(
      (call: any[]) => call[0] === 'watermarkedFile',
    );
    expect(watermarkedCalls).toHaveLength(0);
  });

  it('does NOT append watermarkedFile when watermarkedFileUri is undefined', async () => {
    await uploadItem({
      fileUri: 'file:///videos/compressed.mp4',
      watermarkedFileUri: undefined,
      albumIds: ['507f1f77bcf86cd799439011'],
    });

    expect(mockUploadMultipart).toHaveBeenCalledTimes(1);
    const watermarkedCalls = appendSpy.mock.calls.filter(
      (call: any[]) => call[0] === 'watermarkedFile',
    );
    expect(watermarkedCalls).toHaveLength(0);
  });

  it('skips watermarkedFile when the watermarked file does not exist', async () => {
    // First call for primary file exists, second call for watermarked doesn't
    const { File } = require('expo-file-system');
    let fileCallCount = 0;
    (File as jest.Mock).mockImplementation((uri: string) => {
      fileCallCount++;
      return {
        uri,
        get exists() {
          // Primary file (first FSFile construction) exists;
          // Watermarked file (later FSFile construction) does not
          return fileCallCount <= 1;
        },
      };
    });

    await uploadItem({
      fileUri: 'file:///videos/compressed.mp4',
      watermarkedFileUri: 'file:///cache/missing-watermarked.mp4',
      albumIds: ['507f1f77bcf86cd799439011'],
    });

    expect(mockUploadMultipart).toHaveBeenCalledTimes(1);
    const watermarkedCalls = appendSpy.mock.calls.filter(
      (call: any[]) => call[0] === 'watermarkedFile',
    );
    expect(watermarkedCalls).toHaveLength(0);
  });
});
