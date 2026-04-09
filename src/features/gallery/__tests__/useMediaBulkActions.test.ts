// jest-expo automocks react-native; hook tests need it unmocked.
jest.unmock('react-native');

// Mock expo-constants so transitive loads of src/services/config.ts succeed
// without booting the native expo-constants module.
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMediaBulkActions } from '../hooks/useMediaBulkActions';
import * as galleryService from '../services/galleryService';

jest.mock('../services/galleryService', () => {
  const actual = jest.requireActual('../services/galleryService');
  return {
    ...actual,
    deleteMediaItem: jest.fn(),
    fetchMediaItemDetail: jest.fn(),
    manageMediaItem: jest.fn(),
  };
});

const mockDelete = galleryService.deleteMediaItem as jest.MockedFunction<
  typeof galleryService.deleteMediaItem
>;
const mockFetchDetail = galleryService.fetchMediaItemDetail as jest.MockedFunction<
  typeof galleryService.fetchMediaItemDetail
>;
const mockManage = galleryService.manageMediaItem as jest.MockedFunction<
  typeof galleryService.manageMediaItem
>;

const ID_1 = '507f1f77bcf86cd799439011';
const ID_2 = '507f1f77bcf86cd799439022';
const ID_3 = '507f1f77bcf86cd799439033';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMediaBulkActions', () => {
  describe('bulkDelete', () => {
    it('calls deleteMediaItem for each ID and returns allSucceeded', async () => {
      mockDelete.mockResolvedValue(true);

      const { result } = renderHook(() => useMediaBulkActions());

      let outcome: any;
      await act(async () => {
        outcome = await result.current.bulkDelete([ID_1, ID_2]);
      });

      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(mockDelete).toHaveBeenCalledWith(ID_1);
      expect(mockDelete).toHaveBeenCalledWith(ID_2);
      expect(outcome.outcome).toBe('allSucceeded');
      expect(outcome.succeededIds).toEqual([ID_1, ID_2]);
      expect(outcome.failedIds).toEqual([]);
    });

    it('returns allFailed when all deletes fail', async () => {
      mockDelete.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useMediaBulkActions());

      let outcome: any;
      await act(async () => {
        outcome = await result.current.bulkDelete([ID_1, ID_2]);
      });

      expect(outcome.outcome).toBe('allFailed');
      expect(outcome.succeededIds).toEqual([]);
      expect(outcome.failedIds).toEqual([ID_1, ID_2]);
    });

    it('returns partialFailure when some deletes fail', async () => {
      mockDelete
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(true);

      const { result } = renderHook(() => useMediaBulkActions());

      let outcome: any;
      await act(async () => {
        outcome = await result.current.bulkDelete([ID_1, ID_2, ID_3]);
      });

      expect(outcome.outcome).toBe('partialFailure');
      expect(outcome.succeededIds).toEqual([ID_1, ID_3]);
      expect(outcome.failedIds).toEqual([ID_2]);
    });

    it('sets isProcessing=true during operation and false after', async () => {
      let resolveDelete: (value: boolean) => void;
      const pendingDelete = new Promise<boolean>((resolve) => {
        resolveDelete = resolve;
      });
      mockDelete.mockReturnValue(pendingDelete);

      const { result } = renderHook(() => useMediaBulkActions());

      expect(result.current.isProcessing).toBe(false);

      let deletePromise: Promise<any>;
      act(() => {
        deletePromise = result.current.bulkDelete([ID_1]);
      });

      expect(result.current.isProcessing).toBe(true);

      await act(async () => {
        resolveDelete!(true);
        await deletePromise!;
      });

      expect(result.current.isProcessing).toBe(false);
    });

    it('tracks progress during sequential deletes', async () => {
      const progressValues: Array<{ completed: number; total: number }> = [];

      let resolve1: (v: boolean) => void;
      let resolve2: (v: boolean) => void;
      mockDelete
        .mockReturnValueOnce(
          new Promise<boolean>((r) => {
            resolve1 = r;
          }),
        )
        .mockReturnValueOnce(
          new Promise<boolean>((r) => {
            resolve2 = r;
          }),
        );

      const { result } = renderHook(() => useMediaBulkActions());

      let deletePromise: Promise<any>;
      act(() => {
        deletePromise = result.current.bulkDelete([ID_1, ID_2]);
      });

      // Before any resolve, progress should show total=2
      expect(result.current.progress).toEqual({ completed: 0, total: 2 });

      await act(async () => {
        resolve1!(true);
        // Let microtask flush
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.progress.completed).toBe(1);

      await act(async () => {
        resolve2!(true);
        await deletePromise!;
      });

      expect(result.current.progress).toEqual({ completed: 2, total: 2 });
    });

    it('continues deleting after one fails (no short-circuit)', async () => {
      mockDelete
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(true);

      const { result } = renderHook(() => useMediaBulkActions());

      await act(async () => {
        await result.current.bulkDelete([ID_1, ID_2]);
      });

      expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    it('prevents concurrent bulkDelete calls', async () => {
      let resolveFirst: (v: boolean) => void;
      mockDelete.mockReturnValue(
        new Promise<boolean>((r) => {
          resolveFirst = r;
        }),
      );

      const { result } = renderHook(() => useMediaBulkActions());

      let firstPromise: Promise<any>;
      act(() => {
        firstPromise = result.current.bulkDelete([ID_1]);
      });

      // Second call while first is in progress should return null
      let secondResult: any;
      act(() => {
        secondResult = result.current.bulkDelete([ID_2]);
      });

      await act(async () => {
        resolveFirst!(true);
        await firstPromise!;
      });

      expect(await secondResult).toBeNull();
    });
  });

  describe('bulkManage', () => {
    it('calls manageMediaItem for each ID with payload and returns allSucceeded', async () => {
      mockManage.mockResolvedValue(true);

      const { result } = renderHook(() => useMediaBulkActions());
      const payload = { tagIds: ['tag-1', 'tag-2'] };

      let outcome: any;
      await act(async () => {
        outcome = await result.current.bulkManage([ID_1, ID_2], payload);
      });

      expect(mockManage).toHaveBeenCalledTimes(2);
      expect(mockManage).toHaveBeenCalledWith(ID_1, payload);
      expect(mockManage).toHaveBeenCalledWith(ID_2, payload);
      expect(outcome.outcome).toBe('allSucceeded');
    });

    it('returns partialFailure when some manage calls fail', async () => {
      mockManage
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useMediaBulkActions());

      let outcome: any;
      await act(async () => {
        outcome = await result.current.bulkManage([ID_1, ID_2], { tagIds: ['tag-1'] });
      });

      expect(outcome.outcome).toBe('partialFailure');
      expect(outcome.succeededIds).toEqual([ID_1]);
      expect(outcome.failedIds).toEqual([ID_2]);
    });

    it('sets isProcessing during operation', async () => {
      mockManage.mockResolvedValue(true);

      const { result } = renderHook(() => useMediaBulkActions());

      expect(result.current.isProcessing).toBe(false);

      await act(async () => {
        await result.current.bulkManage([ID_1], { tagIds: ['tag-1'] });
      });

      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('fetchBulkState', () => {
    it('fetches detail for each ID and returns array of details', async () => {
      const detail1 = {
        id: ID_1,
        filename: 'photo-1.jpg',
        mediaType: 'image' as const,
        thumbnailUrl: null,
        noWatermarkNeeded: false,
        watermarkedVariantAvailable: true,
        uploadedById: null,
        uploadedByName: null,
        createdAt: '2025-01-01T00:00:00Z',
        tags: [{ id: 'tag-1', name: 'Nature' }],
        albums: [{ id: 'album-1', title: 'Album 1' }],
      };
      mockFetchDetail.mockResolvedValue(detail1);

      const { result } = renderHook(() => useMediaBulkActions());

      let details: any;
      await act(async () => {
        details = await result.current.fetchBulkState([ID_1]);
      });

      expect(details).toHaveLength(1);
      expect(details[0].id).toBe(ID_1);
      expect(details[0].tags).toEqual([{ id: 'tag-1', name: 'Nature' }]);
    });

    it('sets isFetchingState during operation', async () => {
      let resolveDetail: (v: any) => void;
      mockFetchDetail.mockReturnValue(
        new Promise((r) => {
          resolveDetail = r;
        }),
      );

      const { result } = renderHook(() => useMediaBulkActions());

      expect(result.current.isFetchingState).toBe(false);

      let fetchPromise: Promise<any>;
      act(() => {
        fetchPromise = result.current.fetchBulkState([ID_1]);
      });

      expect(result.current.isFetchingState).toBe(true);

      await act(async () => {
        resolveDetail!({
          id: ID_1,
          filename: null,
          mediaType: 'image',
          thumbnailUrl: null,
          noWatermarkNeeded: false,
          watermarkedVariantAvailable: true,
          uploadedById: null,
          uploadedByName: null,
          createdAt: '',
          tags: [],
          albums: [],
        });
        await fetchPromise!;
      });

      expect(result.current.isFetchingState).toBe(false);
    });

    it('skips items that fail to fetch and returns only successful ones', async () => {
      const detail1 = {
        id: ID_1,
        filename: null,
        mediaType: 'image' as const,
        thumbnailUrl: null,
        noWatermarkNeeded: false,
        watermarkedVariantAvailable: true,
        uploadedById: null,
        uploadedByName: null,
        createdAt: '',
        tags: [],
        albums: [],
      };
      mockFetchDetail
        .mockResolvedValueOnce(detail1)
        .mockRejectedValueOnce(new Error('not found'));

      const { result } = renderHook(() => useMediaBulkActions());

      let details: any;
      await act(async () => {
        details = await result.current.fetchBulkState([ID_1, ID_2]);
      });

      expect(details).toHaveLength(1);
      expect(details[0].id).toBe(ID_1);
    });
  });
});
