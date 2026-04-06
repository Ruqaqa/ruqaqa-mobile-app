/**
 * Tests for dual-variant video upload: compress-only optimizeVideo + separate watermarkVideo.
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

let ffmpegMock: any;
let optimizeVideo: typeof import('../services/videoOptimizationService').optimizeVideo;
let watermarkVideo: typeof import('../services/videoOptimizationService').watermarkVideo;

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

  jest.resetModules();

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
});

// --- Tests ---

describe('optimizeVideo (compress-only, no watermark params)', () => {
  it('only accepts uri and onProgress params (no watermarkDraft/logoUri)', async () => {
    // After refactoring, optimizeVideo should only take (uri, onProgress?)
    // Calling with just uri should work and only call buildCompressCommand
    const result = await optimizeVideo('file:///videos/clip.mp4');

    expect(result.wasOptimized).toBe(true);
    expect(ffmpegMock.buildCompressCommand).toHaveBeenCalled();
    expect(ffmpegMock.buildWatermarkCommand).not.toHaveBeenCalled();
  });

  it('never calls buildWatermarkCommand regardless of arguments', async () => {
    // Even with extra args, the refactored optimizeVideo signature should
    // only do compression. The function no longer accepts watermark params.
    await optimizeVideo('file:///videos/clip.mp4', undefined);

    expect(ffmpegMock.buildCompressCommand).toHaveBeenCalled();
    expect(ffmpegMock.buildWatermarkCommand).not.toHaveBeenCalled();
  });
});

describe('watermarkVideo', () => {
  const draft: WatermarkDraft = {
    ...DEFAULT_WATERMARK_DRAFT,
    noWatermarkNeeded: false,
  };
  const logoUri = 'file:///assets/logo.png';

  it('calls FFmpeg with watermark overlay command', async () => {
    const result = await watermarkVideo(
      'file:///videos/compressed.mp4',
      draft,
      logoUri,
    );

    expect(ffmpegMock.buildWatermarkCommand).toHaveBeenCalled();
    expect(ffmpegMock.execute).toHaveBeenCalled();
    expect(result.wasOptimized).toBe(true);
  });

  it('gets video dimensions via getMediaInfo for pixel conversion', async () => {
    await watermarkVideo('file:///videos/compressed.mp4', draft, logoUri);

    expect(ffmpegMock.getMediaInfo).toHaveBeenCalled();
  });

  it('returns original URI on FFmpeg failure', async () => {
    ffmpegMock.execute.mockResolvedValue({ returnCode: 1, output: 'error' });

    const result = await watermarkVideo(
      'file:///videos/compressed.mp4',
      draft,
      logoUri,
    );

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/compressed.mp4');
  });

  it('returns original URI on thrown exception', async () => {
    ffmpegMock.execute.mockRejectedValue(new Error('Native crash'));

    const result = await watermarkVideo(
      'file:///videos/compressed.mp4',
      draft,
      logoUri,
    );

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/compressed.mp4');
  });

  it('retries with libx264 when hardware encoder fails', async () => {
    ffmpegMock.execute
      .mockResolvedValueOnce({ returnCode: 1, output: 'encoder error' })
      .mockResolvedValueOnce({ returnCode: 0, output: 'success' });

    const result = await watermarkVideo(
      'file:///videos/compressed.mp4',
      draft,
      logoUri,
    );

    expect(ffmpegMock.execute).toHaveBeenCalledTimes(2);
    expect(result.wasOptimized).toBe(true);
  });

  it('rejects non-local URIs without processing', async () => {
    const result = await watermarkVideo(
      'http://example.com/video.mp4',
      draft,
      logoUri,
    );

    expect(result.wasOptimized).toBe(false);
    expect(ffmpegMock.execute).not.toHaveBeenCalled();
  });

  it('rejects invalid logo URI without processing', async () => {
    const result = await watermarkVideo(
      'file:///videos/compressed.mp4',
      draft,
      'http://example.com/logo.png',
    );

    expect(result.wasOptimized).toBe(false);
    expect(ffmpegMock.execute).not.toHaveBeenCalled();
  });

  it('reports progress via callback', async () => {
    const progressValues: number[] = [];
    ffmpegMock.execute.mockImplementation(
      (_cmd: string, onProgress: (data: any) => void) => {
        if (onProgress) {
          onProgress({ percentage: 50 });
          onProgress({ percentage: 100 });
        }
        return Promise.resolve({ returnCode: 0, output: '' });
      },
    );

    await watermarkVideo(
      'file:///videos/compressed.mp4',
      draft,
      logoUri,
      (p) => progressValues.push(p),
    );

    expect(progressValues).toEqual([0.5, 1.0]);
  });
});
