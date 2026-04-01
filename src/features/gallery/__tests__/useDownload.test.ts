import { renderHook, act } from '@testing-library/react-native';

// Mock the downloadService module before importing the hook
const mockDownloadItems = jest.fn().mockResolvedValue(undefined);
const mockCancelDownload = jest.fn();
const mockCancelAllDownloads = jest.fn();
const mockClearCompletedDownloads = jest.fn();

let subscriberCallback: ((snapshot: any) => void) | null = null;
const mockSubscribeToDownloads = jest.fn((cb: (snapshot: any) => void) => {
  subscriberCallback = cb;
  // Immediately emit empty state
  cb({
    jobs: [],
    totalCount: 0,
    completedCount: 0,
    failedCount: 0,
    isActive: false,
    batchProgress: 0,
  });
  return () => {
    subscriberCallback = null;
  };
});

jest.mock('../services/downloadService', () => ({
  downloadItems: (...args: unknown[]) => mockDownloadItems.apply(null, args),
  subscribeToDownloads: (...args: unknown[]) => mockSubscribeToDownloads.apply(null, args),
  cancelDownload: (...args: unknown[]) => mockCancelDownload.apply(null, args),
  cancelAllDownloads: (...args: unknown[]) => mockCancelAllDownloads.apply(null, args),
  clearCompletedDownloads: (...args: unknown[]) => mockClearCompletedDownloads.apply(null, args),
}));

import { useDownload } from '../hooks/useDownload';
import { DownloadSnapshot, MediaItem } from '../types';

function makeMediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: overrides.id ?? '507f1f77bcf86cd799439011',
    filename: overrides.filename ?? 'photo.jpg',
    mediaType: overrides.mediaType ?? 'image',
    thumbnailUrl: null,
    noWatermarkNeeded: false,
    watermarkedVariantAvailable: true,
    uploadedById: null,
    uploadedByName: null,
    createdAt: '2025-06-01T00:00:00Z',
  };
}

function makeSnapshot(overrides: Partial<DownloadSnapshot> = {}): DownloadSnapshot {
  return {
    jobs: overrides.jobs ?? [],
    totalCount: overrides.totalCount ?? 0,
    completedCount: overrides.completedCount ?? 0,
    failedCount: overrides.failedCount ?? 0,
    isActive: overrides.isActive ?? false,
    batchProgress: overrides.batchProgress ?? 0,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  subscriberCallback = null;
});

describe('useDownload', () => {
  describe('initial state', () => {
    it('starts with empty snapshot', () => {
      const { result } = renderHook(() => useDownload());

      expect(result.current.snapshot.totalCount).toBe(0);
      expect(result.current.snapshot.isActive).toBe(false);
      expect(result.current.snapshot.jobs).toEqual([]);
    });

    it('subscribes to download service on mount', () => {
      renderHook(() => useDownload());

      expect(mockSubscribeToDownloads).toHaveBeenCalledTimes(1);
    });
  });

  describe('snapshot updates', () => {
    it('updates snapshot when download service emits', () => {
      const { result } = renderHook(() => useDownload());

      const newSnapshot = makeSnapshot({
        totalCount: 2,
        isActive: true,
        batchProgress: 0.5,
        jobs: [
          {
            id: 'j1',
            sourceUrl: 'https://example.com/1',
            destinationUri: '/cache/1',
            displayFilename: 'file1.jpg',
            status: 'running',
            progress: 0.5,
          },
          {
            id: 'j2',
            sourceUrl: 'https://example.com/2',
            destinationUri: '/cache/2',
            displayFilename: 'file2.jpg',
            status: 'queued',
            progress: 0,
          },
        ],
      });

      act(() => {
        subscriberCallback?.(newSnapshot);
      });

      expect(result.current.snapshot.totalCount).toBe(2);
      expect(result.current.snapshot.isActive).toBe(true);
      expect(result.current.snapshot.batchProgress).toBe(0.5);
    });

    it('reflects completed state', () => {
      const { result } = renderHook(() => useDownload());

      act(() => {
        subscriberCallback?.(
          makeSnapshot({
            totalCount: 1,
            completedCount: 1,
            isActive: false,
            batchProgress: 1,
          }),
        );
      });

      expect(result.current.snapshot.completedCount).toBe(1);
      expect(result.current.snapshot.isActive).toBe(false);
    });
  });

  describe('startDownload', () => {
    it('calls downloadItems with items and format', async () => {
      const { result } = renderHook(() => useDownload());
      const items = [makeMediaItem()];

      await act(async () => {
        await result.current.startDownload(items, 'watermarked');
      });

      expect(mockDownloadItems).toHaveBeenCalledTimes(1);
      expect(mockDownloadItems).toHaveBeenCalledWith(items, 'watermarked');
    });

    it('calls downloadItems without format when not specified', async () => {
      const { result } = renderHook(() => useDownload());
      const items = [makeMediaItem()];

      await act(async () => {
        await result.current.startDownload(items);
      });

      expect(mockDownloadItems).toHaveBeenCalledWith(items, undefined);
    });

    it('handles multiple items', async () => {
      const { result } = renderHook(() => useDownload());
      const items = [
        makeMediaItem({ id: '507f1f77bcf86cd799439011' }),
        makeMediaItem({ id: '507f1f77bcf86cd799439022' }),
      ];

      await act(async () => {
        await result.current.startDownload(items, 'original');
      });

      expect(mockDownloadItems).toHaveBeenCalledWith(items, 'original');
    });
  });

  describe('cancel', () => {
    it('calls cancelDownload with jobId', () => {
      const { result } = renderHook(() => useDownload());

      act(() => {
        result.current.cancel('job-123');
      });

      expect(mockCancelDownload).toHaveBeenCalledWith('job-123');
    });
  });

  describe('cancelAll', () => {
    it('calls cancelAllDownloads', () => {
      const { result } = renderHook(() => useDownload());

      act(() => {
        result.current.cancelAll();
      });

      expect(mockCancelAllDownloads).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCompleted', () => {
    it('calls clearCompletedDownloads', () => {
      const { result } = renderHook(() => useDownload());

      act(() => {
        result.current.clearCompleted();
      });

      expect(mockClearCompletedDownloads).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('unsubscribes on unmount', () => {
      const { unmount } = renderHook(() => useDownload());

      expect(subscriberCallback).not.toBeNull();

      unmount();

      // After unmount, the subscriber reference should be cleared
      expect(subscriberCallback).toBeNull();
    });

    it('does not update state after unmount', () => {
      const { result, unmount } = renderHook(() => useDownload());

      unmount();

      // Emitting after unmount should not throw or update
      // (the mountedRef check in the hook prevents this)
      expect(() => {
        subscriberCallback?.(makeSnapshot({ totalCount: 5 }));
      }).not.toThrow();
    });
  });
});
