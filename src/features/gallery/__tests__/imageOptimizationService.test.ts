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
      // First call = original file, second call = optimized file, third = dest file
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
      // Optimized or dest files
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

const mockSaveAsync = jest.fn();
const mockRenderAsync = jest.fn();
const mockResize = jest.fn();
const mockManipulate = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: (...args: any[]) => mockManipulate(...args),
  },
  SaveFormat: { WEBP: 'webp', PNG: 'png' },
}));

function resetFileCallCount() {
  const { File } = require('expo-file-system');
  (File as jest.Mock).mockClear();
  // Reset the internal callCount by re-mocking
}

beforeEach(() => {
  jest.clearAllMocks();

  // Reset File call counter by re-implementing
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

  // Default: manipulate chain works
  mockSaveAsync.mockResolvedValue({ uri: 'file:///cache/optimized.webp' });
  mockRenderAsync.mockResolvedValue({ saveAsync: mockSaveAsync });
  mockResize.mockReturnValue({ renderAsync: mockRenderAsync });
  mockManipulate.mockReturnValue({ resize: mockResize });

  mockOriginalSize.mockReturnValue(500_000);
  mockOptimizedSize.mockReturnValue(200_000);
  mockOptimizedExists.mockReturnValue(false);
});

describe('optimizeImage', () => {
  // --- Format detection ---

  it('converts JPEG to WebP', async () => {
    const result = await optimizeImage('file:///photos/photo.jpg');

    expect(result.wasOptimized).toBe(true);
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'webp', compress: 0.65 }),
    );
  });

  it('converts HEIC to WebP', async () => {
    const result = await optimizeImage('file:///photos/photo.heic');

    expect(result.wasOptimized).toBe(true);
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'webp' }),
    );
  });

  it('converts HEIF to WebP', async () => {
    const result = await optimizeImage('file:///photos/photo.heif');

    expect(result.wasOptimized).toBe(true);
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'webp' }),
    );
  });

  it('keeps PNG as PNG with quality 1.0', async () => {
    const result = await optimizeImage('file:///photos/screenshot.png');

    expect(result.wasOptimized).toBe(true);
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'png', compress: 1.0 }),
    );
  });

  it('skips unknown extensions (returns original)', async () => {
    const result = await optimizeImage('file:///files/document.gif');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///files/document.gif');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('skips files with no extension', async () => {
    const result = await optimizeImage('file:///files/noext');

    expect(result.wasOptimized).toBe(false);
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  // --- Resize ---

  it('resizes to MAX_DIMENSION (2048)', async () => {
    await optimizeImage('file:///photos/photo.jpg');

    expect(mockResize).toHaveBeenCalledWith({ width: 2048, height: 2048 });
  });

  // --- Skip-if-larger ---

  it('returns original when optimized file is larger', async () => {
    mockOriginalSize.mockReturnValue(100_000);
    mockOptimizedSize.mockReturnValue(150_000);

    const result = await optimizeImage('file:///photos/small.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///photos/small.jpg');
    expect(result.originalSize).toBe(100_000);
    expect(result.optimizedSize).toBe(100_000);
  });

  it('returns original when optimized file is same size', async () => {
    mockOriginalSize.mockReturnValue(100_000);
    mockOptimizedSize.mockReturnValue(100_000);

    const result = await optimizeImage('file:///photos/same.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///photos/same.jpg');
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
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'webp' }),
    );
  });

  // --- Error handling ---

  it('returns original on manipulator error', async () => {
    mockManipulate.mockImplementation(() => {
      throw new Error('Manipulator failed');
    });

    const result = await optimizeImage('file:///photos/bad.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///photos/bad.jpg');
  });

  it('returns original on renderAsync error', async () => {
    mockRenderAsync.mockRejectedValue(new Error('Render failed'));

    const result = await optimizeImage('file:///photos/bad.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///photos/bad.jpg');
  });

  it('returns original on saveAsync error', async () => {
    mockSaveAsync.mockRejectedValue(new Error('Save failed'));

    const result = await optimizeImage('file:///photos/bad.jpg');

    expect(result.wasOptimized).toBe(false);
    expect(result.uri).toBe('file:///photos/bad.jpg');
  });

  // --- Extension edge cases ---

  it('strips query params from URI before detecting extension', async () => {
    const result = await optimizeImage('file:///photos/photo.jpg?token=abc123');

    expect(result.wasOptimized).toBe(true);
    expect(mockSaveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'webp' }),
    );
  });
});
