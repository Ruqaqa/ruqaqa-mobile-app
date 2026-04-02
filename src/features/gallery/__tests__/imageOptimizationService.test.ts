import { optimizeImage } from '../services/imageOptimizationService';

// --- Mocks ---

const mockOriginalSize = jest.fn<number, []>();
const mockOriginalDelete = jest.fn();
const mockOptimizedSize = jest.fn<number, []>();
const mockOptimizedDelete = jest.fn();
const mockOptimizedExists = jest.fn<boolean, []>();
const mockOptimizedMove = jest.fn();

jest.mock('expo-file-system', () => {
  let callCount = 0;
  return {
    File: jest.fn().mockImplementation((uriOrBase: string, name?: string) => {
      const uri = name ? `${uriOrBase}/${name}` : uriOrBase;
      callCount++;
      const current = callCount;
      if (current === 1) {
        // Original file
        return {
          uri,
          get size() { return mockOriginalSize(); },
          delete: mockOriginalDelete,
        };
      }
      // Compressed or dest files
      return {
        uri,
        get size() { return mockOptimizedSize(); },
        delete: mockOptimizedDelete,
        get exists() { return mockOptimizedExists(); },
        move: mockOptimizedMove,
      };
    }),
    Paths: { cache: 'file:///cache' },
  };
});

const mockImageCompress = jest.fn<Promise<string>, [string, any]>();

jest.mock('react-native-compressor', () => ({
  Image: {
    compress: (...args: any[]) => mockImageCompress(args[0], args[1]),
  },
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
        delete: mockOriginalDelete,
      };
    }
    return {
      uri,
      get size() { return mockOptimizedSize(); },
      delete: mockOptimizedDelete,
      get exists() { return mockOptimizedExists(); },
      move: mockOptimizedMove,
    };
  });

  // Default: compress succeeds
  mockImageCompress.mockResolvedValue('file:///cache/compressed.jpg');

  mockOriginalSize.mockReturnValue(500_000);
  mockOptimizedSize.mockReturnValue(200_000);
  mockOptimizedExists.mockReturnValue(false);
});

describe('optimizeImage', () => {
  // --- Format detection ---

  it('compresses JPEG with lossy quality 0.65 and jpg output', async () => {
    const result = await optimizeImage('file:///photos/photo.jpg');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalledWith(
      'file:///photos/photo.jpg',
      expect.objectContaining({
        compressionMethod: 'manual',
        quality: 0.65,
        output: 'jpg',
        maxWidth: 2048,
        maxHeight: 2048,
      }),
    );
  });

  it('compresses HEIC with lossy quality and jpg output', async () => {
    const result = await optimizeImage('file:///photos/photo.heic');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalledWith(
      'file:///photos/photo.heic',
      expect.objectContaining({ quality: 0.65, output: 'jpg' }),
    );
  });

  it('compresses HEIF with lossy quality and jpg output', async () => {
    const result = await optimizeImage('file:///photos/photo.heif');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalledWith(
      'file:///photos/photo.heif',
      expect.objectContaining({ quality: 0.65, output: 'jpg' }),
    );
  });

  it('keeps PNG as PNG with quality 1', async () => {
    mockImageCompress.mockResolvedValue('file:///cache/compressed.png');

    const result = await optimizeImage('file:///photos/screenshot.png');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalledWith(
      'file:///photos/screenshot.png',
      expect.objectContaining({ quality: 1, output: 'png' }),
    );
  });

  it('skips unknown extensions (returns original)', async () => {
    const result = await optimizeImage('file:///files/document.gif');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///files/document.gif');
    expect(mockImageCompress).not.toHaveBeenCalled();
  });

  it('skips files with no extension', async () => {
    const result = await optimizeImage('file:///files/noext');

    expect(result.wasOptimized).toBe(false);
    expect(mockImageCompress).not.toHaveBeenCalled();
  });

  // --- Resize ---

  it('passes MAX_DIMENSION (2048) as maxWidth and maxHeight', async () => {
    await optimizeImage('file:///photos/photo.jpg');

    expect(mockImageCompress).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxWidth: 2048, maxHeight: 2048 }),
    );
  });

  // --- Skip-if-larger ---

  it('returns compressed file when optimized is not smaller (compressor may consume source)', async () => {
    mockOriginalSize.mockReturnValue(100_000);
    mockOptimizedSize.mockReturnValue(150_000);

    const result = await optimizeImage('file:///photos/small.jpg');

    expect(result.wasOptimized).toBe(false);
    // Always returns the compressed file URI because react-native-compressor
    // may consume/delete the source file on Android during compression.
    expect(result.uri).toContain('optimized_small');
    expect(result.originalSize).toBe(100_000);
    expect(result.optimizedSize).toBe(100_000);
  });

  it('returns compressed file when optimized is same size', async () => {
    mockOriginalSize.mockReturnValue(100_000);
    mockOptimizedSize.mockReturnValue(100_000);

    const result = await optimizeImage('file:///photos/same.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toContain('optimized_same');
  });

  // --- Successful optimization ---

  it('returns optimized result with correct sizes', async () => {
    mockOriginalSize.mockReturnValue(500_000);
    mockOptimizedSize.mockReturnValue(200_000);

    const result = await optimizeImage('file:///photos/photo.jpeg');

    expect(result.wasOptimized).toBe(true);
    expect(result.originalSize).toBe(500_000);
    expect(result.optimizedSize).toBe(200_000);
  });

  it('handles case-insensitive extensions', async () => {
    const result = await optimizeImage('file:///photos/photo.JPG');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalledWith(
      'file:///photos/photo.JPG',
      expect.objectContaining({ output: 'jpg' }),
    );
  });

  // --- Error handling ---

  it('returns original on compress error', async () => {
    mockImageCompress.mockRejectedValue(new Error('Compress failed'));

    const result = await optimizeImage('file:///photos/bad.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///photos/bad.jpg');
  });

  // --- URI scheme validation ---

  it('rejects http:// URIs without calling compress', async () => {
    const result = await optimizeImage('http://example.com/photo.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.originalSize).toBe(0);
    expect(result.optimizedSize).toBe(0);
    expect(mockImageCompress).not.toHaveBeenCalled();
  });

  it('rejects https:// URIs without calling compress', async () => {
    const result = await optimizeImage('https://example.com/photo.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.originalSize).toBe(0);
    expect(mockImageCompress).not.toHaveBeenCalled();
  });

  it('rejects data: URIs without calling compress', async () => {
    const result = await optimizeImage('data:image/jpeg;base64,abc123');

    expect(result.wasOptimized).toBe(false);
    expect(mockImageCompress).not.toHaveBeenCalled();
  });

  it('accepts file:// URIs', async () => {
    const result = await optimizeImage('file:///photos/photo.jpg');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalled();
  });

  it('accepts absolute paths starting with /', async () => {
    const result = await optimizeImage('/data/photos/photo.jpg');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalled();
  });

  // --- Extension edge cases ---

  it('strips query params from URI before detecting extension', async () => {
    const result = await optimizeImage('file:///photos/photo.jpg?token=abc123');

    expect(result.wasOptimized).toBe(true);
    expect(mockImageCompress).toHaveBeenCalledWith(
      'file:///photos/photo.jpg?token=abc123',
      expect.objectContaining({ output: 'jpg' }),
    );
  });
});
