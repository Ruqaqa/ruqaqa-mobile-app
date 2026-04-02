import { UploadPipeline } from '../services/uploadPipeline';
import type { PipelineStatus, PipelineResult } from '../types';
import { MAX_FILE_SIZE_BYTES, MAX_CONCURRENT_UPLOADS } from '../types';

// --- Mocks ---

// Mock expo-file-system
const mockFileSize = jest.fn<number, []>().mockReturnValue(1_000_000);
const mockFileExists = jest.fn<boolean, []>().mockReturnValue(true);
const mockFileDelete = jest.fn();
const mockFileMove = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    get size() { return mockFileSize(); },
    get exists() { return mockFileExists(); },
    delete: mockFileDelete,
    move: mockFileMove,
  })),
  Paths: { cache: 'file:///cache' },
}));

// Mock fileHashService
const mockComputeFileHash = jest.fn();
jest.mock('../services/fileHashService', () => ({
  computeFileHash: (...args: any[]) => mockComputeFileHash(...args),
}));

// Mock imageOptimizationService
const mockOptimizeImage = jest.fn();
jest.mock('../services/imageOptimizationService', () => ({
  optimizeImage: (...args: any[]) => mockOptimizeImage(...args),
}));

// Mock galleryService
const mockCheckHash = jest.fn();
const mockAddItemToAlbums = jest.fn();
const mockUploadItem = jest.fn();
jest.mock('../services/galleryService', () => ({
  checkHash: (...args: any[]) => mockCheckHash(...args),
  addItemToAlbums: (...args: any[]) => mockAddItemToAlbums(...args),
  uploadItem: (...args: any[]) => mockUploadItem(...args),
}));

// --- Helpers ---

function makeImage(uri: string) {
  return { uri, width: 1920, height: 1080, type: 'image' as const, assetId: uri };
}

function makeVideo(uri: string) {
  return { uri, width: 1920, height: 1080, type: 'video' as const, assetId: uri };
}

const HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  // Default: hash succeeds, no duplicate, optimize succeeds (not smaller), upload succeeds
  mockComputeFileHash.mockResolvedValue(HASH);
  mockCheckHash.mockResolvedValue({ exists: false, hash: HASH });
  mockOptimizeImage.mockImplementation((uri: string) =>
    Promise.resolve({
      uri,
      wasOptimized: false,
      originalSize: 1_000_000,
      optimizedSize: 1_000_000,
    }),
  );
  mockUploadItem.mockResolvedValue({ outcome: 'success' });
  mockFileSize.mockReturnValue(1_000_000);
});

afterEach(() => {
  jest.useRealTimers();
});

// --- Tests ---

describe('UploadPipeline', () => {
  // --- Basic flow ---

  it('completes a single image upload successfully', async () => {
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });

  it('processes multiple images and returns correct counts', async () => {
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg'), makeImage('file:///img2.jpg'), makeImage('file:///img3.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(3);
    expect(result.totalCount).toBe(3);
  });

  it('handles video upload in pipeline', async () => {
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [],
      video: makeVideo('file:///video1.mp4'),
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('handles images + video combined', async () => {
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: makeVideo('file:///video1.mp4'),
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  // --- Progress reporting ---

  it('calls onStatusChanged with increasing progress', async () => {
    const statuses: PipelineStatus[] = [];
    const onStatusChanged = jest.fn((s: PipelineStatus) => statuses.push({ ...s }));
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(onStatusChanged).toHaveBeenCalled();
    // Progress should end at 1.0 (or close to)
    const lastStatus = statuses[statuses.length - 1];
    expect(lastStatus.progress).toBeCloseTo(1.0, 1);
  });

  it('initializes all items with waiting state', async () => {
    const statuses: PipelineStatus[] = [];
    const onStatusChanged = jest.fn((s: PipelineStatus) => statuses.push({ ...s }));
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///a.jpg'), makeImage('file:///b.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    // First status should have all items as 'waiting'
    expect(statuses[0].items).toHaveLength(2);
    expect(statuses[0].items[0].state).toBe('waiting');
    expect(statuses[0].items[1].state).toBe('waiting');
  });

  it('transitions item through hashing → checkingDuplicate → optimizing → uploading → done', async () => {
    const states: string[] = [];
    const onStatusChanged = jest.fn((s: PipelineStatus) => {
      if (s.items[0]) states.push(s.items[0].state);
    });
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(states).toContain('waiting');
    expect(states).toContain('hashing');
    expect(states).toContain('checkingDuplicate');
    expect(states).toContain('optimizing');
    expect(states).toContain('uploading');
    expect(states).toContain('done');
  });

  it('reports correct filenames from URIs', async () => {
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///photos/my-photo.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(onStatusChanged.mock.calls[0][0].items[0].filename).toBe('my-photo.jpg');
  });

  // --- Duplicate handling ---

  it('skips item when duplicate found and no callback', async () => {
    mockCheckHash.mockResolvedValue({
      exists: true,
      hash: HASH,
      item: { id: 'existing-id' },
    });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///dup.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.skippedCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(mockUploadItem).not.toHaveBeenCalled();
  });

  it('adds to albums when duplicate found and user chooses addToAlbums', async () => {
    const VALID_ID = '507f1f77bcf86cd799439011';
    mockCheckHash.mockResolvedValue({
      exists: true,
      hash: HASH,
      item: { id: VALID_ID },
    });
    mockAddItemToAlbums.mockResolvedValue({ success: true });

    const onDuplicateFound = jest.fn().mockResolvedValue({
      decision: 'addToAlbums' as const,
      applyToAll: false,
    });
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///dup.jpg')],
      video: null,
      albumIds: ['album1'],
      tagIds: ['tag1'],
      projectId: 'proj1',
      onStatusChanged,
      onDuplicateFound,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(mockAddItemToAlbums).toHaveBeenCalledTimes(1);
    expect(mockAddItemToAlbums).toHaveBeenCalledWith(VALID_ID, ['album1'], ['tag1'], 'proj1');
    expect(mockUploadItem).not.toHaveBeenCalled();
  });

  it('skips item when duplicate found and user chooses skip', async () => {
    mockCheckHash.mockResolvedValue({
      exists: true,
      hash: HASH,
      item: { id: 'existing-id' },
    });

    const onDuplicateFound = jest.fn().mockResolvedValue({
      decision: 'skip' as const,
      applyToAll: false,
    });
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///dup.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
      onDuplicateFound,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.skippedCount).toBe(1);
    expect(result.successCount).toBe(0);
  });

  it('applies applyToAll decision to subsequent duplicates', async () => {
    mockCheckHash.mockResolvedValue({
      exists: true,
      hash: HASH,
      item: { id: 'existing-id' },
    });
    mockAddItemToAlbums.mockResolvedValue({ success: true });

    const onDuplicateFound = jest.fn().mockResolvedValue({
      decision: 'skip' as const,
      applyToAll: true,
    });
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///dup1.jpg'), makeImage('file:///dup2.jpg'), makeImage('file:///dup3.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
      onDuplicateFound,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    // Callback only called once (applyToAll on first)
    expect(onDuplicateFound).toHaveBeenCalledTimes(1);
    expect(result.skippedCount).toBe(3);
  });

  it('continues without dedup when hash computation fails', async () => {
    mockComputeFileHash.mockRejectedValue(new Error('hash failed'));

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    // Should still upload successfully
    expect(result.successCount).toBe(1);
    expect(mockUploadItem).toHaveBeenCalled();
  });

  it('continues without dedup when checkHash fails', async () => {
    mockCheckHash.mockRejectedValue(new Error('network error'));

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(1);
  });

  // --- Size check ---

  it('marks item as sizeExceeded when optimized file exceeds max size', async () => {
    mockFileSize.mockReturnValue(MAX_FILE_SIZE_BYTES + 1);

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///huge.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.oversizedCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(mockUploadItem).not.toHaveBeenCalled();
  });

  it('allows file exactly at max size', async () => {
    mockFileSize.mockReturnValue(MAX_FILE_SIZE_BYTES);

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///exact.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(1);
    expect(result.oversizedCount).toBe(0);
  });

  it('marks video as sizeExceeded when too large', async () => {
    mockFileSize.mockReturnValue(MAX_FILE_SIZE_BYTES + 1);

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [],
      video: makeVideo('file:///huge_video.mp4'),
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.oversizedCount).toBe(1);
    expect(result.successCount).toBe(0);
  });

  // --- Retry logic ---

  it('retries failed upload up to MAX_UPLOAD_RETRIES times', async () => {
    mockUploadItem
      .mockResolvedValueOnce({ outcome: 'failure' })
      .mockResolvedValueOnce({ outcome: 'failure' })
      .mockResolvedValueOnce({ outcome: 'success' });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///retry.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(1);
    expect(mockUploadItem).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('fails after exhausting all retries', async () => {
    mockUploadItem.mockResolvedValue({ outcome: 'failure' });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///hopeless.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.failedCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(mockUploadItem).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('uses exponential backoff between retries', async () => {
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    mockUploadItem
      .mockResolvedValueOnce({ outcome: 'failure' })
      .mockResolvedValueOnce({ outcome: 'failure' })
      .mockResolvedValueOnce({ outcome: 'success' });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///backoff.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    // Check that setTimeout was called with exponential backoff values
    const delays = (setTimeoutSpy.mock.calls as Array<[Function, number?, ...unknown[]]>)
      .map((call) => call[1])
      .filter((d): d is number => typeof d === 'number' && d >= 500);

    expect(delays).toContain(500);   // 500 * 2^0
    expect(delays).toContain(1000);  // 500 * 2^1

    setTimeoutSpy.mockRestore();
  });

  it('does not retry on duplicate outcome', async () => {
    mockUploadItem.mockResolvedValue({ outcome: 'duplicate' });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///dup-upload.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.failedCount).toBe(1);
    expect(mockUploadItem).toHaveBeenCalledTimes(1);
  });

  it('does not retry on fileTooLarge outcome', async () => {
    mockUploadItem.mockResolvedValue({ outcome: 'fileTooLarge' });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///too-large.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.oversizedCount).toBe(1);
    expect(mockUploadItem).toHaveBeenCalledTimes(1);
  });

  // --- Optimization & bytes saved ---

  it('tracks bytesSaved when optimization reduces size', async () => {
    mockOptimizeImage.mockResolvedValue({
      uri: 'file:///cache/optimized.webp',
      wasOptimized: true,
      originalSize: 500_000,
      optimizedSize: 200_000,
    });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.bytesSaved).toBe(300_000);
    expect(result.successCount).toBe(1);
  });

  it('handles optimization failure gracefully (marks item failed)', async () => {
    mockOptimizeImage.mockRejectedValue(new Error('optimize failed'));

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///bad.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.failedCount).toBe(1);
    expect(mockUploadItem).not.toHaveBeenCalled();
  });

  // --- Concurrent uploads ---

  it('limits concurrent uploads to MAX_CONCURRENT_UPLOADS', async () => {
    let activeUploads = 0;
    let maxActive = 0;

    mockUploadItem.mockImplementation(() => {
      activeUploads++;
      maxActive = Math.max(maxActive, activeUploads);
      return new Promise((resolve) =>
        setTimeout(() => {
          activeUploads--;
          resolve({ outcome: 'success' });
        }, 100),
      );
    });

    const images = Array.from({ length: 6 }, (_, i) =>
      makeImage(`file:///img${i}.jpg`),
    );
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images,
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.successCount).toBe(6);
    expect(maxActive).toBeLessThanOrEqual(MAX_CONCURRENT_UPLOADS);
  });

  // --- Upload parameters ---

  it('passes correct params to uploadItem', async () => {
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1', 'album2'],
      tagIds: ['tag1'],
      projectId: 'proj1',
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockUploadItem).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUri: 'file:///img1.jpg',
        albumIds: ['album1', 'album2'],
        tagIds: ['tag1'],
        projectId: 'proj1',
      }),
    );
  });

  it('passes originalSourceHash from dedup check', async () => {
    mockComputeFileHash.mockResolvedValue('abc123def456');

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockUploadItem).toHaveBeenCalledWith(
      expect.objectContaining({
        originalSourceHash: 'abc123def456',
      }),
    );
  });

  // --- Watermark drafts ---

  it('passes watermark draft for image when available', async () => {
    const onStatusChanged = jest.fn();
    const img = makeImage('file:///img1.jpg');
    const pipeline = new UploadPipeline({
      images: [img],
      video: null,
      albumIds: ['album1'],
      watermarkDrafts: {
        [img.uri]: { xPct: 40, yPct: 40, widthPct: 20, opacityPct: 50, noWatermarkNeeded: false },
      },
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockUploadItem).toHaveBeenCalledWith(
      expect.objectContaining({
        watermarkDraft: expect.objectContaining({ xPct: 40, yPct: 40 }),
        noWatermarkNeeded: false,
      }),
    );
  });

  it('sets noWatermarkNeeded from watermark draft', async () => {
    const onStatusChanged = jest.fn();
    const img = makeImage('file:///img1.jpg');
    const pipeline = new UploadPipeline({
      images: [img],
      video: null,
      albumIds: ['album1'],
      watermarkDrafts: {
        [img.uri]: { xPct: 0, yPct: 0, widthPct: 0, opacityPct: 0, noWatermarkNeeded: true },
      },
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockUploadItem).toHaveBeenCalledWith(
      expect.objectContaining({
        noWatermarkNeeded: true,
      }),
    );
  });

  // --- Result tracking ---

  it('returns correct result with mixed outcomes', async () => {
    // img1: success, img2: size exceeded, img3: duplicate (skip)
    mockOptimizeImage
      .mockResolvedValueOnce({ uri: 'file:///img1.jpg', wasOptimized: false, originalSize: 100, optimizedSize: 100 })
      .mockResolvedValueOnce({ uri: 'file:///img2.jpg', wasOptimized: false, originalSize: 100, optimizedSize: 100 });

    mockCheckHash
      .mockResolvedValueOnce({ exists: false, hash: 'hash1' })
      .mockResolvedValueOnce({ exists: false, hash: 'hash2' })
      .mockResolvedValueOnce({ exists: true, hash: 'hash3', item: { id: 'dup-id' } });

    // Second image is oversized
    let callIdx = 0;
    mockFileSize.mockImplementation(() => {
      callIdx++;
      // The FSFile constructor is called multiple times; make the size check for img2 return a huge value
      return 1_000_000;
    });

    mockUploadItem
      .mockResolvedValueOnce({ outcome: 'success' })
      .mockResolvedValueOnce({ outcome: 'fileTooLarge' });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [
        makeImage('file:///img1.jpg'),
        makeImage('file:///img2.jpg'),
        makeImage('file:///img3.jpg'),
      ],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.totalCount).toBe(3);
    expect(result.successCount).toBe(1);
    expect(result.oversizedCount).toBe(1);  // fileTooLarge from uploadItem
    expect(result.skippedCount).toBe(1);    // duplicate skip
  });

  // --- Empty input ---

  it('returns zero counts for empty input', async () => {
    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.totalCount).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });

  // --- Cleanup ---

  it('cleans up temp files after pipeline completes', async () => {
    mockOptimizeImage.mockResolvedValue({
      uri: 'file:///cache/optimized.webp',
      wasOptimized: true,
      originalSize: 500_000,
      optimizedSize: 200_000,
    });

    const onStatusChanged = jest.fn();
    const pipeline = new UploadPipeline({
      images: [makeImage('file:///img1.jpg')],
      video: null,
      albumIds: ['album1'],
      onStatusChanged,
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    // Temp file cleanup should have been attempted
    expect(mockFileDelete).toHaveBeenCalled();
  });
});
