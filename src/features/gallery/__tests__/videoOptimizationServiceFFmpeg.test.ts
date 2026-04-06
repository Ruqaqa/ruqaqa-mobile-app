/**
 * Tests for the FFmpeg-based video optimization service.
 * The expo-ffmpeg module is mocked via moduleNameMapper in jest.config.js.
 */

// --- Mocks ---

const mockOriginalSize = jest.fn<number, []>();
const mockOutputSize = jest.fn<number, []>();
const mockOutputDelete = jest.fn();
const mockOutputExists = jest.fn<boolean, []>();

jest.mock('expo-file-system', () => {
  let callCount = 0;
  return {
    File: jest.fn().mockImplementation((uriOrBase: string, name?: string) => {
      const uri = name ? `${uriOrBase}/${name}` : uriOrBase;
      callCount++;
      const current = callCount;
      if (current === 1) {
        return {
          uri,
          get size() { return mockOriginalSize(); },
          get exists() { return true; },
        };
      }
      return {
        uri,
        get size() { return mockOutputSize(); },
        delete: mockOutputDelete,
        write: jest.fn(),
        get exists() { return mockOutputExists(); },
      };
    }),
    Paths: { cache: 'file:///cache' },
  };
});

// Mock Skia (used by prepareLogoWithOpacity for baking opacity into logo PNG)
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Image: {
      MakeImageFromEncoded: jest.fn().mockReturnValue({
        width: () => 200,
        height: () => 80,
      }),
    },
    Surface: {
      MakeOffscreen: jest.fn().mockReturnValue({
        getCanvas: jest.fn().mockReturnValue({
          clear: jest.fn(),
          drawImage: jest.fn(),
        }),
        flush: jest.fn(),
        makeImageSnapshot: jest.fn().mockReturnValue({
          encodeToBytes: jest.fn().mockReturnValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
        }),
      }),
    },
    Data: {
      fromURI: jest.fn().mockReturnValue({}),
    },
    Paint: jest.fn().mockReturnValue({
      setAlphaf: jest.fn(),
    }),
    Color: jest.fn().mockReturnValue(0),
  },
}), { virtual: true });

// --- Setup ---

import type { WatermarkDraft } from '../types';
import { DEFAULT_WATERMARK_DRAFT } from '../types';

// Get references to the mocked FFmpeg functions
let ffmpegMock: any;
let optimizeVideo: typeof import('../services/videoOptimizationService').optimizeVideo;
let watermarkVideo: typeof import('../services/videoOptimizationService').watermarkVideo;
let cancelVideoCompression: typeof import('../services/videoOptimizationService').cancelVideoCompression;
let generateVideoThumbnail: typeof import('../services/videoOptimizationService').generateVideoThumbnail;

beforeEach(() => {
  jest.clearAllMocks();

  // Reset File call counter
  let callCount = 0;
  const { File } = require('expo-file-system');
  (File as jest.Mock).mockImplementation((uriOrBase: string, name?: string) => {
    const uri = name ? `${uriOrBase}/${name}` : uriOrBase;
    callCount++;
    const current = callCount;
    if (current === 1) {
      return {
        uri,
        get size() { return mockOriginalSize(); },
        get exists() { return true; },
      };
    }
    return {
      uri,
      get size() { return mockOutputSize(); },
      delete: mockOutputDelete,
      write: jest.fn(),
      get exists() { return mockOutputExists(); },
    };
  });

  mockOriginalSize.mockReturnValue(50_000_000);
  mockOutputSize.mockReturnValue(20_000_000);
  mockOutputExists.mockReturnValue(true);

  // Reset modules to get fresh service state
  jest.resetModules();

  // Get the FFmpeg mock (resolved by moduleNameMapper)
  ffmpegMock = require('expo-ffmpeg');
  ffmpegMock.execute.mockResolvedValue({ returnCode: 0, output: 'success' });
  ffmpegMock.getPreferredEncoder.mockReturnValue('h264_videotoolbox');
  ffmpegMock.buildCompressCommand.mockReturnValue('-i input -c:v h264_videotoolbox output.mp4');
  ffmpegMock.buildWatermarkCommand.mockReturnValue('-i input -i logo -c:v h264_videotoolbox output.mp4');
  ffmpegMock.getMediaInfo.mockResolvedValue({ width: 1920, height: 1080, duration: 60 });
  ffmpegMock.getErrorCode.mockReturnValue('UNKNOWN');

  const mod = require('../services/videoOptimizationService');
  optimizeVideo = mod.optimizeVideo;
  watermarkVideo = mod.watermarkVideo;
  cancelVideoCompression = mod.cancelVideoCompression;
  generateVideoThumbnail = mod.generateVideoThumbnail;
});

// --- Tests ---

describe('optimizeVideo (FFmpeg)', () => {
  it('compresses video and returns optimized result', async () => {
    const result = await optimizeVideo('file:///videos/clip.mp4');

    expect(result.wasOptimized).toBe(true);
    expect(result.originalSize).toBe(50_000_000);
    expect(result.optimizedSize).toBe(20_000_000);
  });

  it('calls buildCompressCommand when no watermark provided', async () => {
    await optimizeVideo('file:///videos/clip.mp4');

    expect(ffmpegMock.buildCompressCommand).toHaveBeenCalled();
    expect(ffmpegMock.buildWatermarkCommand).not.toHaveBeenCalled();
  });

  it('always calls buildCompressCommand (no watermark support in optimizeVideo)', async () => {
    await optimizeVideo('file:///videos/clip.mp4');

    expect(ffmpegMock.buildCompressCommand).toHaveBeenCalled();
    expect(ffmpegMock.buildWatermarkCommand).not.toHaveBeenCalled();
  });

  it('watermarkVideo calls buildWatermarkCommand with draft and logo', async () => {
    await watermarkVideo(
      'file:///videos/clip.mp4',
      { ...DEFAULT_WATERMARK_DRAFT, noWatermarkNeeded: false },
      'file:///assets/logo.png',
    );

    expect(ffmpegMock.buildWatermarkCommand).toHaveBeenCalled();
    expect(ffmpegMock.buildCompressCommand).not.toHaveBeenCalled();
  });

  it('maps FFmpeg progress percentage to 0-1 range', async () => {
    const progressValues: number[] = [];
    ffmpegMock.execute.mockImplementation(
      (_cmd: string, onProgress: (data: any) => void) => {
        if (onProgress) {
          onProgress({ percentage: 25 });
          onProgress({ percentage: 50 });
          onProgress({ percentage: 100 });
        }
        return Promise.resolve({ returnCode: 0, output: '' });
      },
    );

    await optimizeVideo('file:///videos/clip.mp4', (p) => progressValues.push(p));

    expect(progressValues).toEqual([0.25, 0.5, 1.0]);
  });

  it('retries with libx264 when hardware encoder fails', async () => {
    ffmpegMock.execute
      .mockResolvedValueOnce({ returnCode: 1, output: 'encoder error' })
      .mockResolvedValueOnce({ returnCode: 0, output: 'success' });

    const result = await optimizeVideo('file:///videos/clip.mp4');

    expect(ffmpegMock.execute).toHaveBeenCalledTimes(2);
    expect(result.wasOptimized).toBe(true);
  });

  it('does not retry when already using libx264', async () => {
    ffmpegMock.getPreferredEncoder.mockReturnValue('libx264');
    ffmpegMock.buildCompressCommand.mockReturnValue('-i input -c:v libx264 output.mp4');
    ffmpegMock.execute.mockResolvedValue({ returnCode: 1, output: 'error' });

    const result = await optimizeVideo('file:///videos/clip.mp4');

    expect(ffmpegMock.execute).toHaveBeenCalledTimes(1);
    expect(result.wasOptimized).toBe(false);
  });

  it('returns original when output is larger', async () => {
    mockOriginalSize.mockReturnValue(10_000_000);
    mockOutputSize.mockReturnValue(15_000_000);

    const result = await optimizeVideo('file:///videos/small.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/small.mp4');
    expect(mockOutputDelete).toHaveBeenCalled();
  });

  it('returns original on FFmpeg error', async () => {
    ffmpegMock.execute.mockResolvedValue({ returnCode: 1, output: 'error' });

    const result = await optimizeVideo('file:///videos/bad.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/bad.mp4');
  });

  it('returns original on thrown exception', async () => {
    ffmpegMock.execute.mockRejectedValue(new Error('Native crash'));

    const result = await optimizeVideo('file:///videos/crash.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/crash.mp4');
  });

  it('rejects http:// URIs without processing', async () => {
    const result = await optimizeVideo('http://example.com/video.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.originalSize).toBe(0);
    expect(ffmpegMock.execute).not.toHaveBeenCalled();
  });

  it('accepts file:// URIs', async () => {
    await optimizeVideo('file:///videos/clip.mp4');

    expect(ffmpegMock.execute).toHaveBeenCalled();
  });
});

describe('cancelVideoCompression', () => {
  it('calls ffmpegCancel when processing is active', async () => {
    // Start a processing that never resolves
    ffmpegMock.execute.mockReturnValue(new Promise(() => {}));
    const promise = optimizeVideo('file:///videos/clip.mp4');

    await new Promise((r) => setTimeout(r, 10));

    cancelVideoCompression();

    expect(ffmpegMock.cancel).toHaveBeenCalled();
  });
});

describe('generateVideoThumbnail', () => {
  it('returns thumbnail URI on success', async () => {
    mockOutputExists.mockReturnValue(true);

    const result = await generateVideoThumbnail('file:///videos/clip.mp4');

    expect(result).not.toBeNull();
    expect(ffmpegMock.execute).toHaveBeenCalled();
  });

  it('returns null on FFmpeg failure', async () => {
    ffmpegMock.execute.mockResolvedValue({ returnCode: 1, output: 'error' });

    const result = await generateVideoThumbnail('file:///videos/bad.mp4');

    expect(result).toBeNull();
  });

  it('returns null for invalid URI', async () => {
    const result = await generateVideoThumbnail('http://example.com/video.mp4');

    expect(result).toBeNull();
    expect(ffmpegMock.execute).not.toHaveBeenCalled();
  });
});
