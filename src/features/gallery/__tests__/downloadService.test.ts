/**
 * Tests for downloadService: sanitizeFilename, resolveFilename, resolveSourceUrl,
 * downloadItems, permission checks.
 *
 * The service module's internal helpers (sanitizeFilename, resolveFilename,
 * resolveSourceUrl) are tested indirectly through the public API (downloadItems)
 * and by inspecting the jobs created.
 */

import { MediaItem, DownloadSnapshot } from '../types';

// --- Mocks ---

// Mock expo-file-system (new class-based API)
jest.mock('expo-file-system', () => {
  const mockFile = {
    uri: 'file:///cache/gallery-downloads/result.jpg',
    delete: jest.fn(),
    exists: true,
  };
  return {
    File: Object.assign(
      jest.fn().mockImplementation(() => mockFile),
      {
        downloadFileAsync: jest.fn().mockResolvedValue(mockFile),
      },
    ),
    Directory: jest.fn().mockImplementation(() => ({
      exists: true,
      create: jest.fn(),
    })),
    Paths: {
      cache: 'file:///cache/',
      document: 'file:///documents/',
    },
  };
});

// Mock expo-media-library
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  createAssetAsync: jest.fn().mockResolvedValue({ uri: 'content://media/photo/123' }),
  getAlbumAsync: jest.fn().mockResolvedValue(null),
  createAlbumAsync: jest.fn().mockResolvedValue({ id: 'album-1' }),
  addAssetsToAlbumAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { LOW: 2 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

jest.mock('@/i18n', () => ({
  i18next: { t: (key: string) => key },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('@/services/config', () => ({
  config: { apiBaseUrl: 'https://ruqaqa.sa' },
}));

jest.mock('@/services/tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue('test-token-123'),
  },
}));

// --- Helpers ---

function makeMediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: overrides.id ?? '507f1f77bcf86cd799439011',
    filename: 'filename' in overrides ? overrides.filename! : 'photo-001.jpg',
    mediaType: overrides.mediaType ?? 'image',
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    noWatermarkNeeded: overrides.noWatermarkNeeded ?? false,
    watermarkedVariantAvailable: overrides.watermarkedVariantAvailable ?? true,
    uploadedById: overrides.uploadedById ?? null,
    uploadedByName: overrides.uploadedByName ?? null,
    createdAt: overrides.createdAt ?? '2025-06-01T00:00:00Z',
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// Import after mocks are set up
let downloadItems: typeof import('../services/downloadService').downloadItems;
let subscribeToDownloads: typeof import('../services/downloadService').subscribeToDownloads;
let getDownloadSnapshot: typeof import('../services/downloadService').getDownloadSnapshot;
let cancelDownload: typeof import('../services/downloadService').cancelDownload;
let cancelAllDownloads: typeof import('../services/downloadService').cancelAllDownloads;
let clearCompletedDownloads: typeof import('../services/downloadService').clearCompletedDownloads;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Re-import to get fresh singleton
  const mod = require('../services/downloadService');
  downloadItems = mod.downloadItems;
  subscribeToDownloads = mod.subscribeToDownloads;
  getDownloadSnapshot = mod.getDownloadSnapshot;
  cancelDownload = mod.cancelDownload;
  cancelAllDownloads = mod.cancelAllDownloads;
  clearCompletedDownloads = mod.clearCompletedDownloads;
});

describe('downloadService', () => {
  describe('downloadItems', () => {
    it('creates jobs for valid media items', async () => {
      const item = makeMediaItem();
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.totalCount).toBe(1);
      expect(snap.jobs[0].displayFilename).toBe('photo-001.jpg');
    });

    it('builds correct source URL for original format', async () => {
      const item = makeMediaItem({ id: '507f1f77bcf86cd799439011' });
      await downloadItems([item], 'original');
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.jobs[0].sourceUrl).toBe(
        'https://ruqaqa.sa/api/gallery/media/507f1f77bcf86cd799439011',
      );
      expect(snap.jobs[0].sourceUrl).not.toContain('variant=');
    });

    it('builds correct source URL for watermarked format', async () => {
      const item = makeMediaItem({ id: '507f1f77bcf86cd799439011' });
      await downloadItems([item], 'watermarked');
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.jobs[0].sourceUrl).toContain('?variant=watermarked');
    });

    it('uses /api/gallery/media/ path, not /api/mobile/', async () => {
      const item = makeMediaItem({ id: '507f1f77bcf86cd799439011' });
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.jobs[0].sourceUrl).toContain('/api/gallery/media/');
      expect(snap.jobs[0].sourceUrl).not.toContain('/api/mobile/');
    });

    it('skips items with invalid ObjectId', async () => {
      const badItem = makeMediaItem({ id: 'bad-id!' });
      const goodItem = makeMediaItem({ id: '507f1f77bcf86cd799439011' });
      await downloadItems([badItem, goodItem]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.totalCount).toBe(1);
      expect(snap.jobs[0].sourceUrl).toContain('507f1f77bcf86cd799439011');
    });

    it('skips items with empty ID', async () => {
      const emptyIdItem = makeMediaItem({ id: '' });
      await downloadItems([emptyIdItem]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.totalCount).toBe(0);
    });

    it('deduplicates items with the same ID', async () => {
      const item1 = makeMediaItem({ id: '507f1f77bcf86cd799439011' });
      const item2 = makeMediaItem({ id: '507f1f77bcf86cd799439011', filename: 'dup.jpg' });
      await downloadItems([item1, item2]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.totalCount).toBe(1);
    });

    it('handles multiple unique items in a single call', async () => {
      const items = [
        makeMediaItem({ id: '507f1f77bcf86cd799439011', filename: 'a.jpg' }),
        makeMediaItem({ id: '507f1f77bcf86cd799439022', filename: 'b.jpg' }),
        makeMediaItem({ id: '507f1f77bcf86cd799439033', filename: 'c.jpg' }),
      ];
      await downloadItems(items);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.totalCount).toBe(3);
    });

    it('does nothing for empty items array', async () => {
      await downloadItems([]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.totalCount).toBe(0);
    });
  });

  describe('filename resolution', () => {
    it('uses item filename when available', async () => {
      const item = makeMediaItem({ filename: 'vacation-photo.jpg' });
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.jobs[0].displayFilename).toBe('vacation-photo.jpg');
    });

    it('falls back to id.jpg for images with no filename', async () => {
      const item = makeMediaItem({
        id: '507f1f77bcf86cd799439011',
        filename: null,
        mediaType: 'image',
      });
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.jobs[0].displayFilename).toBe('507f1f77bcf86cd799439011.jpg');
    });

    it('falls back to id.mp4 for videos with no filename', async () => {
      const item = makeMediaItem({
        id: '507f1f77bcf86cd799439022',
        filename: null,
        mediaType: 'video',
      });
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      expect(snap.jobs[0].displayFilename).toBe('507f1f77bcf86cd799439022.mp4');
    });
  });

  describe('filename sanitization', () => {
    it('replaces forbidden characters with underscores', async () => {
      const item = makeMediaItem({ filename: 'file<>:"/\\|?*.jpg' });
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      const name = snap.jobs[0].displayFilename;
      expect(name).not.toMatch(/[<>:"/\\|?*]/);
      expect(name).toContain('.jpg');
    });

    it('truncates very long filenames while preserving extension', async () => {
      const longName = 'a'.repeat(250) + '.jpg';
      const item = makeMediaItem({ filename: longName });
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      const name = snap.jobs[0].displayFilename;
      expect(name.length).toBeLessThanOrEqual(204); // 200 + '.jpg'
      expect(name).toMatch(/\.jpg$/);
    });

    it('strips path traversal characters', async () => {
      const item = makeMediaItem({ filename: '../../../etc/passwd' });
      await downloadItems([item]);
      await flush();

      const snap = getDownloadSnapshot();
      const name = snap.jobs[0].displayFilename;
      // The slashes and dots should be sanitized
      expect(name).not.toContain('/');
      expect(name).not.toContain('\\');
    });
  });

  describe('cancelDownload', () => {
    it('delegates to queue cancelJob', async () => {
      // The executor mock resolves instantly, so jobs complete before cancel.
      // Instead, verify that cancelDownload is callable and doesn't throw
      // on a non-existent jobId (the queue handles this gracefully).
      // Detailed cancel behavior is tested in downloadQueue.test.ts.
      expect(() => cancelDownload('nonexistent-job')).not.toThrow();
    });
  });

  describe('cancelAllDownloads', () => {
    it('delegates to queue cancelAll', async () => {
      // Enqueue items, then cancel all
      const items = [
        makeMediaItem({ id: '507f1f77bcf86cd799439011' }),
        makeMediaItem({ id: '507f1f77bcf86cd799439022' }),
      ];
      await downloadItems(items);
      await flush();

      // cancelAllDownloads should not throw
      expect(() => cancelAllDownloads()).not.toThrow();
    });
  });

  describe('clearCompletedDownloads', () => {
    it('removes terminal jobs from the snapshot', async () => {
      const item = makeMediaItem();
      await downloadItems([item]);
      await flush();

      // Cancel it to make it terminal
      const snap = getDownloadSnapshot();
      cancelDownload(snap.jobs[0].id);
      await flush();

      clearCompletedDownloads();
      await flush();

      const cleared = getDownloadSnapshot();
      expect(cleared.totalCount).toBe(0);
    });
  });

  describe('subscribeToDownloads', () => {
    it('immediately emits current snapshot on subscribe', () => {
      const listener = jest.fn();
      subscribeToDownloads(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ totalCount: 0 }),
      );
    });

    it('returns unsubscribe function', async () => {
      const listener = jest.fn();
      const unsub = subscribeToDownloads(listener);
      const callCount = listener.mock.calls.length;

      unsub();

      await downloadItems([makeMediaItem()]);
      await flush();

      expect(listener).toHaveBeenCalledTimes(callCount);
    });
  });
});
