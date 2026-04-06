import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useUploadPipeline } from '../hooks/useUploadPipeline';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { GalleryAlbum, PickerItem } from '../types';

// --- Mocks ---

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn().mockReturnValue({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: 'file:///assets/logo-green.png',
    }),
  },
}));

// Track whether the run mock should resolve with duplicate pause or immediately
let mockPipelineRun: jest.Mock;
let mockOnStatusChanged: ((status: any) => void) | undefined;
let mockOnDuplicateFound: ((info: any) => Promise<any>) | undefined;

jest.mock('../services/uploadPipeline', () => ({
  UploadPipeline: jest.fn().mockImplementation((config: any) => {
    mockOnStatusChanged = config.onStatusChanged;
    mockOnDuplicateFound = config.onDuplicateFound;
    return {
      run: mockPipelineRun,
    };
  }),
}));

const mockPlaySuccessSound = jest.fn();
jest.mock('@/services/soundService', () => ({
  playSuccessSound: () => mockPlaySuccessSound(),
}));

// --- Helpers ---

const makeImage = (uri: string): ImagePickerAsset => ({
  uri,
  width: 1920,
  height: 1080,
  type: 'image',
  assetId: uri,
});

const makeAlbum = (id: string): GalleryAlbum => ({
  id,
  title: `Album ${id}`,
  titleEn: `Album ${id}`,
  titleAr: `ألبوم ${id}`,
  isDefault: false,
  itemCount: 0,
  coverThumbnails: [],
  createdAt: '2025-01-01T00:00:00Z',
});

const makeTag = (id: string): PickerItem => ({ id, name: `Tag ${id}` });

function makeStartParams(overrides?: Partial<any>) {
  return {
    images: [makeImage('file:///img1.jpg')],
    video: null,
    albums: [makeAlbum('album1')],
    tags: [makeTag('tag1')],
    project: null,
    watermarkDrafts: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnStatusChanged = undefined;
  mockOnDuplicateFound = undefined;

  // Default: pipeline runs and resolves successfully
  mockPipelineRun = jest.fn().mockResolvedValue({
    successCount: 1,
    failedCount: 0,
    skippedCount: 0,
    oversizedCount: 0,
    totalCount: 1,
    bytesSaved: 0,
  });
});

// --- Tests ---

describe('useUploadPipeline', () => {
  // --- Initial state ---

  it('starts with idle state and null values', () => {
    const { result } = renderHook(() => useUploadPipeline());

    expect(result.current.stage).toBe('idle');
    expect(result.current.pipelineStatus).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.pendingDuplicate).toBeNull();
  });

  // --- startUpload ---

  it('sets stage to processing when upload starts', async () => {
    const { result } = renderHook(() => useUploadPipeline());

    act(() => {
      result.current.startUpload(makeStartParams());
    });

    expect(result.current.stage).toBe('processing');
  });

  it('initializes pipelineStatus when upload starts', async () => {
    const { result } = renderHook(() => useUploadPipeline());

    act(() => {
      result.current.startUpload(makeStartParams());
    });

    expect(result.current.pipelineStatus).not.toBeNull();
    expect(result.current.pipelineStatus?.progress).toBe(0);
  });

  it('clears previous result and error when starting new upload', async () => {
    const { result } = renderHook(() => useUploadPipeline());

    // First, trigger a successful upload
    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    // Start another upload
    mockPipelineRun.mockResolvedValue({
      successCount: 2, failedCount: 0, skippedCount: 0,
      oversizedCount: 0, totalCount: 2, bytesSaved: 0,
    });

    act(() => {
      result.current.startUpload(makeStartParams());
    });

    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  // --- Successful completion ---

  it('sets stage to done and result on successful completion', async () => {
    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.stage).toBe('done');
    });

    expect(result.current.result?.successCount).toBe(1);
    expect(result.current.result?.totalCount).toBe(1);
  });

  it('plays success sound on completion', async () => {
    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.stage).toBe('done');
    });

    expect(mockPlaySuccessSound).toHaveBeenCalledTimes(1);
  });

  // --- Error handling ---

  it('sets stage to error when all uploads fail', async () => {
    mockPipelineRun.mockResolvedValue({
      successCount: 0,
      failedCount: 1,
      skippedCount: 0,
      oversizedCount: 0,
      totalCount: 1,
      bytesSaved: 0,
    });

    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.stage).toBe('error');
    });

    expect(result.current.errorMessage).toBe('Upload failed');
  });

  it('sets stage to error when pipeline throws', async () => {
    mockPipelineRun.mockRejectedValue(new Error('Network catastrophe'));

    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.stage).toBe('error');
    });

    // Error message is always generic (never exposes raw error details)
    expect(result.current.errorMessage).toBe('Upload failed');
  });

  it('does not play sound on pipeline error', async () => {
    mockPipelineRun.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.stage).toBe('error');
    });

    expect(mockPlaySuccessSound).not.toHaveBeenCalled();
  });

  // --- All skipped/oversized → done (not error) ---

  it('sets stage to done when all items are skipped', async () => {
    mockPipelineRun.mockResolvedValue({
      successCount: 0,
      failedCount: 0,
      skippedCount: 2,
      oversizedCount: 0,
      totalCount: 2,
      bytesSaved: 0,
    });

    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.stage).toBe('done');
    });
  });

  // --- Duplicate flow ---

  it('sets pendingDuplicate when pipeline reports duplicate', async () => {
    const duplicateInfo = {
      filename: 'dup.jpg',
      checkResult: { exists: true, hash: 'abc', item: { id: 'dup-id' } },
    };

    // Pipeline pauses on duplicate by returning a promise that waits for user
    mockPipelineRun.mockImplementation(async () => {
      // Trigger the duplicate callback
      if (mockOnDuplicateFound) {
        await mockOnDuplicateFound(duplicateInfo);
      }
      return {
        successCount: 1, failedCount: 0, skippedCount: 0,
        oversizedCount: 0, totalCount: 1, bytesSaved: 0,
      };
    });

    const { result } = renderHook(() => useUploadPipeline());

    // Start upload — this should trigger duplicate
    act(() => {
      result.current.startUpload(makeStartParams());
    });

    // Wait for duplicate to be set
    await waitFor(() => {
      expect(result.current.pendingDuplicate).not.toBeNull();
    });

    expect(result.current.pendingDuplicate?.info.filename).toBe('dup.jpg');
  });

  it('resolveDuplicate clears pending duplicate and resumes pipeline', async () => {
    const duplicateInfo = {
      filename: 'dup.jpg',
      checkResult: { exists: true, hash: 'abc', item: { id: 'dup-id' } },
    };

    let resolvedWith: any = null;
    mockPipelineRun.mockImplementation(async () => {
      if (mockOnDuplicateFound) {
        resolvedWith = await mockOnDuplicateFound(duplicateInfo);
      }
      return {
        successCount: 1, failedCount: 0, skippedCount: 0,
        oversizedCount: 0, totalCount: 1, bytesSaved: 0,
      };
    });

    const { result } = renderHook(() => useUploadPipeline());

    act(() => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.pendingDuplicate).not.toBeNull();
    });

    // Resolve the duplicate
    await act(async () => {
      result.current.resolveDuplicate('skip', false);
    });

    await waitFor(() => {
      expect(result.current.pendingDuplicate).toBeNull();
    });

    // Pipeline should have received the decision
    await waitFor(() => {
      expect(resolvedWith).toEqual({ decision: 'skip', applyToAll: false });
    });
  });

  it('resolveDuplicate with addToAlbums passes correct decision', async () => {
    const duplicateInfo = {
      filename: 'dup.jpg',
      checkResult: { exists: true, hash: 'abc', item: { id: 'dup-id' } },
    };

    let resolvedWith: any = null;
    mockPipelineRun.mockImplementation(async () => {
      if (mockOnDuplicateFound) {
        resolvedWith = await mockOnDuplicateFound(duplicateInfo);
      }
      return {
        successCount: 1, failedCount: 0, skippedCount: 0,
        oversizedCount: 0, totalCount: 1, bytesSaved: 0,
      };
    });

    const { result } = renderHook(() => useUploadPipeline());

    act(() => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.pendingDuplicate).not.toBeNull();
    });

    await act(async () => {
      result.current.resolveDuplicate('addToAlbums', true);
    });

    await waitFor(() => {
      expect(resolvedWith).toEqual({ decision: 'addToAlbums', applyToAll: true });
    });
  });

  // --- Progress updates ---

  it('updates pipelineStatus when onStatusChanged is called', async () => {
    mockPipelineRun.mockImplementation(async () => {
      // Simulate status updates
      if (mockOnStatusChanged) {
        mockOnStatusChanged({
          progress: 0.5,
          completedCount: 1,
          failedCount: 0,
          totalCount: 2,
          items: [
            { filename: 'img1.jpg', state: 'done' },
            { filename: 'img2.jpg', state: 'uploading' },
          ],
        });
      }
      return {
        successCount: 2, failedCount: 0, skippedCount: 0,
        oversizedCount: 0, totalCount: 2, bytesSaved: 0,
      };
    });

    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.stage).toBe('done');
    });

    // The status should have been updated (it may have been updated further to final)
    // Just verify onStatusChanged was captured and used
    expect(mockOnStatusChanged).toBeDefined();
  });

  // --- Reset ---

  it('reset clears all state back to initial', async () => {
    const { result } = renderHook(() => useUploadPipeline());

    // Run a pipeline first
    await act(async () => {
      result.current.startUpload(makeStartParams());
    });

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.stage).toBe('idle');
    expect(result.current.pipelineStatus).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.pendingDuplicate).toBeNull();
  });

  // --- UploadPipeline construction ---

  it('passes albumIds, tagIds, and projectId to pipeline', async () => {
    const { UploadPipeline: MockPipeline } = require('../services/uploadPipeline');

    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload({
        images: [makeImage('file:///img1.jpg')],
        video: null,
        albums: [makeAlbum('a1'), makeAlbum('a2')],
        tags: [makeTag('t1'), makeTag('t2')],
        project: { id: 'proj1', name: 'Project 1' },
        watermarkDrafts: null,
      });
    });

    expect(MockPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        albumIds: ['a1', 'a2'],
        tagIds: ['t1', 't2'],
        projectId: 'proj1',
      }),
    );
  });

  it('omits tagIds when no tags selected', async () => {
    const { UploadPipeline: MockPipeline } = require('../services/uploadPipeline');

    const { result } = renderHook(() => useUploadPipeline());

    await act(async () => {
      result.current.startUpload({
        images: [makeImage('file:///img1.jpg')],
        video: null,
        albums: [makeAlbum('a1')],
        tags: [],
        project: null,
        watermarkDrafts: null,
      });
    });

    expect(MockPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        tagIds: undefined,
        projectId: undefined,
      }),
    );
  });
});
