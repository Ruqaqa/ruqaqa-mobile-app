/**
 * Tests for dual-variant video upload pipeline changes.
 * Verifies that video processing now uses separate compress + watermark passes
 * and uploads both original (compressed) and watermarked files.
 */

// --- Mocks ---

const mockFileSize = jest.fn<number, []>().mockReturnValue(1_000_000);
const mockFileExists = jest.fn<boolean, []>().mockReturnValue(true);
const mockFileDelete = jest.fn();
const mockFileMove = jest.fn();
const mockFileCopy = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uriOrBase: string, name?: string) => {
    const uri = name ? `${uriOrBase}/${name}` : uriOrBase;
    return {
      uri,
      get size() { return mockFileSize(); },
      get exists() { return mockFileExists(); },
      delete: mockFileDelete,
      move: mockFileMove,
      copy: mockFileCopy,
    };
  }),
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

// Mock videoOptimizationService (now with watermarkVideo)
const mockOptimizeVideo = jest.fn();
const mockWatermarkVideo = jest.fn();
const mockCancelVideoCompression = jest.fn();
jest.mock('../services/videoOptimizationService', () => ({
  optimizeVideo: (...args: any[]) => mockOptimizeVideo(...args),
  watermarkVideo: (...args: any[]) => mockWatermarkVideo(...args),
  cancelVideoCompression: (...args: any[]) => mockCancelVideoCompression(...args),
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

// Mock watermarkApplicatorService
const mockApplyWatermarkToImage = jest.fn();
jest.mock('../services/watermarkApplicatorService', () => ({
  applyWatermarkToImage: (...args: any[]) => mockApplyWatermarkToImage(...args),
}));

// Mock expo-keep-awake
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn(),
}));

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
}));

// Mock video processing notification service
jest.mock('../services/videoProcessingNotificationService', () => ({
  showVideoProcessingProgress: jest.fn().mockResolvedValue(undefined),
  showVideoProcessingResult: jest.fn().mockResolvedValue(undefined),
  dismissVideoProcessingNotifications: jest.fn().mockResolvedValue(undefined),
}));

import { UploadPipeline } from '../services/uploadPipeline';
import type { WatermarkDraft, PipelineStatus } from '../types';

// --- Helpers ---

function makeVideo(uri: string) {
  return { uri, width: 1920, height: 1080, type: 'video' as const, assetId: uri };
}

const HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const wmDraft: WatermarkDraft = {
  xPct: 40,
  yPct: 40,
  widthPct: 20,
  opacityPct: 30,
  noWatermarkNeeded: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  mockComputeFileHash.mockResolvedValue(HASH);
  mockCheckHash.mockResolvedValue({ exists: false, hash: HASH });
  mockOptimizeVideo.mockImplementation((uri: string) =>
    Promise.resolve({
      uri: 'file:///cache/compressed.mp4',
      wasOptimized: true,
      originalSize: 50_000_000,
      optimizedSize: 20_000_000,
    }),
  );
  mockWatermarkVideo.mockImplementation(() =>
    Promise.resolve({
      uri: 'file:///cache/watermarked.mp4',
      wasOptimized: true,
      originalSize: 20_000_000,
      optimizedSize: 22_000_000,
    }),
  );
  mockUploadItem.mockResolvedValue({ outcome: 'success' });
  mockFileSize.mockReturnValue(1_000_000);
  mockFileExists.mockReturnValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

// --- Tests ---

describe('UploadPipeline dual-variant video', () => {

  it('calls optimizeVideo without watermark params (compress-only)', async () => {
    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: wmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    // optimizeVideo should be called with (uri, progressCallback) only
    // It should NOT receive watermarkDraft or logoUri
    expect(mockOptimizeVideo).toHaveBeenCalledTimes(1);
    const args = mockOptimizeVideo.mock.calls[0];
    expect(args).toHaveLength(2); // uri, onProgress
    expect(typeof args[0]).toBe('string'); // uri
    expect(typeof args[1]).toBe('function'); // onProgress callback
  });

  it('calls watermarkVideo when watermark is needed', async () => {
    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: wmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockWatermarkVideo).toHaveBeenCalledTimes(1);
    const wmArgs = mockWatermarkVideo.mock.calls[0];
    // watermarkVideo(originalSourceUri, watermarkDraft, logoUri, onProgress?)
    // Uses original source (NOT compressed output) to avoid double-encoding
    expect(wmArgs[0]).not.toBe('file:///cache/compressed.mp4');
    expect(wmArgs[0]).toEqual(expect.stringContaining('pipeline_')); // stable copy of original
    expect(wmArgs[1]).toEqual(expect.objectContaining({ xPct: 40, yPct: 40 }));
    expect(wmArgs[2]).toBe('file:///assets/logo.png');
  });

  it('skips watermarkVideo when noWatermarkNeeded is true', async () => {
    const video = makeVideo('file:///video1.mp4');
    const noWmDraft: WatermarkDraft = { ...wmDraft, noWatermarkNeeded: true };
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: noWmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockWatermarkVideo).not.toHaveBeenCalled();
    expect(mockOptimizeVideo).toHaveBeenCalledTimes(1);
  });

  it('skips watermarkVideo when no watermark drafts provided', async () => {
    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockWatermarkVideo).not.toHaveBeenCalled();
  });

  it('skips watermarkVideo when no logoUri provided', async () => {
    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: wmDraft },
      // no logoUri
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockWatermarkVideo).not.toHaveBeenCalled();
  });

  it('passes both fileUri and watermarkedFileUri to uploadItem', async () => {
    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: wmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockUploadItem).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUri: 'file:///cache/compressed.mp4',
        watermarkedFileUri: 'file:///cache/watermarked.mp4',
      }),
    );
  });

  it('uploads without watermarkedFileUri when watermark is not needed', async () => {
    const video = makeVideo('file:///video1.mp4');
    const noWmDraft: WatermarkDraft = { ...wmDraft, noWatermarkNeeded: true };
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: noWmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(mockUploadItem).toHaveBeenCalledWith(
      expect.objectContaining({
        // Should NOT have watermarkedFileUri
      }),
    );
    const uploadCall = mockUploadItem.mock.calls[0][0];
    expect(uploadCall.watermarkedFileUri).toBeUndefined();
  });

  it('watermark failure is non-fatal - uploads without watermarked variant', async () => {
    mockWatermarkVideo.mockRejectedValue(new Error('watermark failed'));

    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: wmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: jest.fn(),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    // Should still succeed — watermark failure is non-fatal
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(mockUploadItem).toHaveBeenCalledTimes(1);
    // No watermarked file URI should be passed
    const uploadCall = mockUploadItem.mock.calls[0][0];
    expect(uploadCall.watermarkedFileUri).toBeUndefined();
  });

  it('transitions through watermarking state when watermark is needed', async () => {
    const states: string[] = [];
    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: wmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: (s: PipelineStatus) => {
        if (s.items[0]) states.push(s.items[0].state);
      },
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(states).toContain('watermarking');
  });

  it('does not transition through watermarking state when watermark is skipped', async () => {
    const states: string[] = [];
    const video = makeVideo('file:///video1.mp4');
    const noWmDraft: WatermarkDraft = { ...wmDraft, noWatermarkNeeded: true };
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: noWmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: (s: PipelineStatus) => {
        if (s.items[0]) states.push(s.items[0].state);
      },
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    expect(states).not.toContain('watermarking');
  });

  it('progress reaches 1.0 with VIDEO_WATERMARK_WEIGHT accounted for', async () => {
    const statuses: PipelineStatus[] = [];
    const video = makeVideo('file:///video1.mp4');
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: wmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: (s: PipelineStatus) => statuses.push({ ...s }),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    const lastStatus = statuses[statuses.length - 1];
    expect(lastStatus.progress).toBeCloseTo(1.0, 1);
  });

  it('progress reaches 1.0 even when watermark is skipped', async () => {
    const statuses: PipelineStatus[] = [];
    const video = makeVideo('file:///video1.mp4');
    const noWmDraft: WatermarkDraft = { ...wmDraft, noWatermarkNeeded: true };
    const pipeline = new UploadPipeline({
      images: [],
      video,
      albumIds: ['album1'],
      watermarkDrafts: { [video.uri]: noWmDraft },
      logoUri: 'file:///assets/logo.png',
      onStatusChanged: (s: PipelineStatus) => statuses.push({ ...s }),
    });

    const resultPromise = pipeline.run();
    await jest.runAllTimersAsync();
    await resultPromise;

    const lastStatus = statuses[statuses.length - 1];
    expect(lastStatus.progress).toBeCloseTo(1.0, 1);
  });
});
