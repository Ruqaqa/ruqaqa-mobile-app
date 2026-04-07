import type { WatermarkDraft } from '../types';
import { DEFAULT_WATERMARK_DRAFT } from '../types';

// --- Mocks ---

const mockOutputDelete = jest.fn();
const mockOutputExists = jest.fn<boolean, []>();
const mockOutputWrite = jest.fn();
const mockLogoExists = jest.fn<boolean, []>().mockReturnValue(true);

jest.mock('expo-file-system', () => {
  let callCount = 0;
  return {
    File: jest.fn().mockImplementation((uriOrBase: string, name?: string) => {
      const uri = name ? `${uriOrBase}/${name}` : uriOrBase;
      const isLogo = uri.includes('logo');
      const isOutput = uri.includes('wm_');
      callCount++;
      return {
        uri,
        get exists() {
          if (isLogo) return mockLogoExists();
          if (isOutput) return mockOutputExists();
          return true;
        },
        delete: mockOutputDelete,
        write: mockOutputWrite,
        text: jest.fn().mockReturnValue(''),
      };
    }),
    Paths: { cache: 'file:///cache' },
  };
});

// Mock Skia (the rendering engine)
const mockMakeImageFromEncoded = jest.fn();
const mockEncodeToBytes = jest.fn();
const mockSurfaceFlush = jest.fn();
const mockMakeImageSnapshot = jest.fn();

const mockCanvas = {
  drawImage: jest.fn(),
  drawImageRect: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  saveLayer: jest.fn(),
};

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Image: {
      MakeImageFromEncoded: (...args: any[]) => mockMakeImageFromEncoded(...args),
    },
    Surface: {
      MakeOffscreen: jest.fn().mockImplementation(() => ({
        getCanvas: jest.fn().mockReturnValue(mockCanvas),
        flush: mockSurfaceFlush,
        makeImageSnapshot: () => mockMakeImageSnapshot(),
        dispose: jest.fn(),
      })),
    },
    Data: {
      fromBytes: jest.fn().mockReturnValue({}),
      fromURI: jest.fn().mockResolvedValue({}),
    },
    Paint: jest.fn().mockReturnValue({
      setAlphaf: jest.fn(),
    }),
    XYWHRect: jest.fn().mockImplementation((x: number, y: number, w: number, h: number) => ({
      x, y, width: w, height: h,
    })),
  },
  AlphaType: { Opaque: 0, Premul: 1 },
  ColorType: { RGBA_8888: 0 },
}), { virtual: true });

// --- Helpers ---

function makeDraft(overrides: Partial<WatermarkDraft> = {}): WatermarkDraft {
  return { ...DEFAULT_WATERMARK_DRAFT, ...overrides };
}

const LOGO_URI = 'file:///assets/logo.png';

// --- Setup ---

let applyWatermarkToImage: typeof import('../services/watermarkApplicatorService').applyWatermarkToImage;
let resetLogoCache: typeof import('../services/watermarkApplicatorService').resetLogoCache;

beforeEach(() => {
  jest.clearAllMocks();

  // Reset File call counter
  let callCount = 0;
  const { File } = require('expo-file-system');
  (File as jest.Mock).mockImplementation((uriOrBase: string, name?: string) => {
    const uri = name ? `${uriOrBase}/${name}` : uriOrBase;
    const isLogo = uri.includes('logo');
    const isOutput = uri.includes('wm_');
    callCount++;
    return {
      uri,
      get exists() {
        if (isLogo) return mockLogoExists();
        if (isOutput) return mockOutputExists();
        return true;
      },
      delete: mockOutputDelete,
      write: mockOutputWrite,
      text: jest.fn().mockReturnValue(''),
    };
  });

  mockOutputExists.mockReturnValue(false);
  mockLogoExists.mockReturnValue(true);

  // Skia image mocks — source image
  mockMakeImageFromEncoded.mockReturnValue({
    width: () => 1920,
    height: () => 1080,
  });

  // Snapshot encode
  mockMakeImageSnapshot.mockReturnValue({
    encodeToBytes: () => mockEncodeToBytes(),
  });
  mockEncodeToBytes.mockReturnValue(new Uint8Array(400_000));

  // Re-import to get fresh module state (resets logo cache)
  jest.resetModules();
  const mod = require('../services/watermarkApplicatorService');
  applyWatermarkToImage = mod.applyWatermarkToImage;
  resetLogoCache = mod.resetLogoCache;
});

// --- Tests ---

describe('applyWatermarkToImage', () => {
  // --- noWatermarkNeeded ---

  it('skips watermarking when noWatermarkNeeded is true', async () => {
    const result = await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft({ noWatermarkNeeded: true }),
      LOGO_URI,
    );

    expect(result.applied).toBe(false);
    expect(result.uri).toBe('file:///photos/photo.jpg');
    expect(mockMakeImageFromEncoded).not.toHaveBeenCalled();
  });

  // --- Successful watermarking ---

  it('applies watermark and returns temp file URI', async () => {
    const result = await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft({ noWatermarkNeeded: false }),
      LOGO_URI,
    );

    expect(result.applied).toBe(true);
    expect(result.uri).toContain('wm_');
    expect(result.uri).not.toBe('file:///photos/photo.jpg');
  });

  it('returns applied=true for valid watermark operation', async () => {
    const result = await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(true);
  });

  it('writes encoded bytes to output file', async () => {
    await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(mockOutputWrite).toHaveBeenCalled();
  });

  // --- Error handling ---

  it('returns original URI when source image loading fails', async () => {
    mockMakeImageFromEncoded.mockReturnValue(null);

    const result = await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(false);
    expect(result.uri).toBe('file:///photos/photo.jpg');
  });

  it('returns original URI when encoding fails', async () => {
    mockEncodeToBytes.mockReturnValue(null);

    const result = await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(false);
    expect(result.uri).toBe('file:///photos/photo.jpg');
  });

  it('returns original URI on any thrown error', async () => {
    mockMakeImageFromEncoded.mockImplementation(() => {
      throw new Error('Skia crash');
    });

    const result = await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(false);
    expect(result.uri).toBe('file:///photos/photo.jpg');
  });

  // --- URI validation ---

  it('rejects http:// URIs without processing', async () => {
    const result = await applyWatermarkToImage(
      'http://example.com/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(false);
    expect(result.uri).toBe('http://example.com/photo.jpg');
    expect(mockMakeImageFromEncoded).not.toHaveBeenCalled();
  });

  it('rejects https:// URIs without processing', async () => {
    const result = await applyWatermarkToImage(
      'https://example.com/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(false);
    expect(mockMakeImageFromEncoded).not.toHaveBeenCalled();
  });

  it('rejects content:// URIs without processing', async () => {
    const result = await applyWatermarkToImage(
      'content://media/external/images/123',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(false);
    expect(mockMakeImageFromEncoded).not.toHaveBeenCalled();
  });

  it('accepts file:// URIs', async () => {
    const result = await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(true);
  });

  it('accepts absolute paths starting with /', async () => {
    const result = await applyWatermarkToImage(
      '/data/photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(result.applied).toBe(true);
  });

  // --- Temp file cleanup ---

  it('cleans up existing temp file before writing new one', async () => {
    mockOutputExists.mockReturnValue(true);

    await applyWatermarkToImage(
      'file:///photos/photo.jpg',
      makeDraft(),
      LOGO_URI,
    );

    expect(mockOutputDelete).toHaveBeenCalled();
  });
});
