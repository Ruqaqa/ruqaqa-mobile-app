import {
  optimizeVideo,
  cancelVideoCompression,
  generateVideoThumbnail,
} from '../services/videoOptimizationService';

// --- Mocks ---

const mockOriginalSize = jest.fn<number, []>();
const mockCompressedSize = jest.fn<number, []>();
const mockCompressedDelete = jest.fn();
const mockCompressedExists = jest.fn<boolean, []>();
const mockCompressedMove = jest.fn();

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
        };
      }
      return {
        uri,
        get size() { return mockCompressedSize(); },
        delete: mockCompressedDelete,
        get exists() { return mockCompressedExists(); },
        move: mockCompressedMove,
      };
    }),
    Paths: { cache: 'file:///cache' },
  };
});

const mockVideoCompress = jest.fn();
const mockCancelCompression = jest.fn();
const mockCreateVideoThumbnail = jest.fn();

jest.mock('react-native-compressor', () => ({
  Video: {
    compress: (...args: any[]) => mockVideoCompress(...args),
    cancelCompression: (...args: any[]) => mockCancelCompression(...args),
  },
  createVideoThumbnail: (...args: any[]) => mockCreateVideoThumbnail(...args),
}));

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
      };
    }
    return {
      uri,
      get size() { return mockCompressedSize(); },
      delete: mockCompressedDelete,
      get exists() { return mockCompressedExists(); },
      move: mockCompressedMove,
    };
  });

  mockOriginalSize.mockReturnValue(50_000_000); // 50MB
  mockCompressedSize.mockReturnValue(20_000_000); // 20MB
  mockCompressedExists.mockReturnValue(false);

  mockVideoCompress.mockResolvedValue('file:///cache/compressed_video.mp4');
});

describe('optimizeVideo', () => {
  it('compresses video with auto method', async () => {
    const result = await optimizeVideo('file:///videos/clip.mp4');

    expect(result.wasOptimized).toBe(true);
    expect(result.originalSize).toBe(50_000_000);
    expect(result.optimizedSize).toBe(20_000_000);
    expect(mockVideoCompress).toHaveBeenCalledWith(
      'file:///videos/clip.mp4',
      expect.objectContaining({
        compressionMethod: 'auto',
        minimumFileSizeForCompress: 0,
      }),
      expect.any(Function), // progress callback
      expect.any(Function), // cancellation ID callback
    );
  });

  it('reports progress via callback', async () => {
    mockVideoCompress.mockImplementation(
      (_uri: string, _opts: any, onProgress: (p: number) => void) => {
        onProgress(0.25);
        onProgress(0.5);
        onProgress(1.0);
        return Promise.resolve('file:///cache/compressed.mp4');
      },
    );

    const progressValues: number[] = [];
    await optimizeVideo('file:///videos/clip.mp4', (p) => progressValues.push(p));

    expect(progressValues).toEqual([0.25, 0.5, 1.0]);
  });

  it('returns original when compressed is larger', async () => {
    mockOriginalSize.mockReturnValue(10_000_000);
    mockCompressedSize.mockReturnValue(15_000_000);

    const result = await optimizeVideo('file:///videos/small.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/small.mp4');
    expect(result.optimizedSize).toBe(10_000_000);
    expect(mockCompressedDelete).toHaveBeenCalled();
  });

  it('returns original when compressed is same size', async () => {
    mockOriginalSize.mockReturnValue(10_000_000);
    mockCompressedSize.mockReturnValue(10_000_000);

    const result = await optimizeVideo('file:///videos/same.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/same.mp4');
  });

  it('returns original on compression error', async () => {
    mockVideoCompress.mockRejectedValue(new Error('Compression failed'));

    const result = await optimizeVideo('file:///videos/bad.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///videos/bad.mp4');
  });

  // --- URI scheme validation ---

  it('rejects http:// URIs without calling compress', async () => {
    const result = await optimizeVideo('http://example.com/video.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.originalSize).toBe(0);
    expect(result.optimizedSize).toBe(0);
    expect(mockVideoCompress).not.toHaveBeenCalled();
  });

  it('rejects https:// URIs without calling compress', async () => {
    const result = await optimizeVideo('https://example.com/video.mp4');

    expect(result.wasOptimized).toBe(false);
    expect(result.originalSize).toBe(0);
    expect(mockVideoCompress).not.toHaveBeenCalled();
  });

  it('rejects content:// URIs without calling compress', async () => {
    const result = await optimizeVideo('content://media/external/video/123');

    expect(result.wasOptimized).toBe(false);
    expect(mockVideoCompress).not.toHaveBeenCalled();
  });

  it('accepts file:// URIs', async () => {
    const result = await optimizeVideo('file:///videos/clip.mp4');

    expect(result.wasOptimized).toBe(true);
    expect(mockVideoCompress).toHaveBeenCalled();
  });

  it('accepts absolute paths starting with /', async () => {
    const result = await optimizeVideo('/data/videos/clip.mp4');

    expect(result.wasOptimized).toBe(true);
    expect(mockVideoCompress).toHaveBeenCalled();
  });
});

describe('cancelVideoCompression', () => {
  it('cancels an active compression', async () => {
    // Start a compression that captures the cancellation ID
    mockVideoCompress.mockImplementation(
      (_uri: string, _opts: any, _onProgress: any, onCancellationId: (id: string) => void) => {
        onCancellationId('cancel-123');
        return new Promise(() => {}); // Never resolves — simulates in-progress
      },
    );

    // Start compression in background (don't await)
    const promise = optimizeVideo('file:///videos/clip.mp4');

    // Wait a tick for the mock to register the cancellation ID
    await new Promise((r) => setTimeout(r, 0));

    await cancelVideoCompression();

    expect(mockCancelCompression).toHaveBeenCalledWith('cancel-123');
  });

  it('does nothing when no compression is active', async () => {
    await cancelVideoCompression();

    expect(mockCancelCompression).not.toHaveBeenCalled();
  });
});

describe('generateVideoThumbnail', () => {
  it('returns thumbnail path on success', async () => {
    mockCreateVideoThumbnail.mockResolvedValue({
      path: 'file:///cache/thumb.jpg',
      size: 5000,
      mime: 'image/jpeg',
      width: 320,
      height: 240,
    });

    const result = await generateVideoThumbnail('file:///videos/clip.mp4');

    expect(result).toBe('file:///cache/thumb.jpg');
    expect(mockCreateVideoThumbnail).toHaveBeenCalledWith('file:///videos/clip.mp4');
  });

  it('returns null on error', async () => {
    mockCreateVideoThumbnail.mockRejectedValue(new Error('Thumbnail failed'));

    const result = await generateVideoThumbnail('file:///videos/bad.mp4');

    expect(result).toBeNull();
  });

  it('returns null when result has no path', async () => {
    mockCreateVideoThumbnail.mockResolvedValue(null);

    const result = await generateVideoThumbnail('file:///videos/clip.mp4');

    expect(result).toBeNull();
  });

  // --- URI scheme validation ---

  it('rejects http:// URIs and returns null', async () => {
    const result = await generateVideoThumbnail('http://example.com/video.mp4');

    expect(result).toBeNull();
    expect(mockCreateVideoThumbnail).not.toHaveBeenCalled();
  });

  it('rejects https:// URIs and returns null', async () => {
    const result = await generateVideoThumbnail('https://example.com/video.mp4');

    expect(result).toBeNull();
    expect(mockCreateVideoThumbnail).not.toHaveBeenCalled();
  });

  it('accepts file:// URIs for thumbnail generation', async () => {
    mockCreateVideoThumbnail.mockResolvedValue({ path: 'file:///cache/thumb.jpg' });

    const result = await generateVideoThumbnail('file:///videos/clip.mp4');

    expect(result).toBe('file:///cache/thumb.jpg');
    expect(mockCreateVideoThumbnail).toHaveBeenCalled();
  });
});
