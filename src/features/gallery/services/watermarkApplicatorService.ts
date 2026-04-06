import { Skia, AlphaType, ColorType } from '@shopify/react-native-skia';
import { File as FSFile, Paths } from 'expo-file-system';
import type { WatermarkDraft } from '../types';
import { clampWatermarkDraft } from '../types';
import { validateSafePath } from '../utils/watermarkValidation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WatermarkResult {
  /** URI of the watermarked image (or original if skipped/failed). */
  uri: string;
  /** Whether the watermark was actually applied. */
  applied: boolean;
}

export interface WatermarkPixels {
  x: number;
  y: number;
  logoWidth: number;
  logoHeight: number;
  opacity: number;
}

// ---------------------------------------------------------------------------
// Coordinate math (pure function, testable independently)
// ---------------------------------------------------------------------------

/**
 * Convert percentage-based WatermarkDraft values to pixel coordinates.
 * All inputs and outputs are validated/clamped.
 */
export function calculateWatermarkPixels(
  draft: WatermarkDraft,
  imageWidth: number,
  imageHeight: number,
  logoAspectRatio: number,
): WatermarkPixels {
  const clamped = clampWatermarkDraft(draft);
  const safeAspect = logoAspectRatio > 0 ? logoAspectRatio : 2.5;

  const x = (clamped.xPct / 100) * imageWidth;
  const y = (clamped.yPct / 100) * imageHeight;
  const logoWidth = (clamped.widthPct / 100) * imageWidth;
  const logoHeight = logoWidth / safeAspect;
  const opacity = clamped.opacityPct / 100;

  return {
    x: Math.round(x),
    y: Math.round(y),
    logoWidth: Math.round(logoWidth),
    logoHeight: Math.round(logoHeight),
    opacity,
  };
}

// ---------------------------------------------------------------------------
// Logo cache
// ---------------------------------------------------------------------------

let _cachedLogoImage: ReturnType<typeof Skia.Image.MakeImageFromEncoded> | null = null;
let _cachedLogoAspectRatio: number = 2.5;

/**
 * Load and cache the bundled watermark logo.
 * Returns the Skia image and its aspect ratio.
 */
async function loadLogo(
  logoUri: string,
): Promise<{ image: NonNullable<ReturnType<typeof Skia.Image.MakeImageFromEncoded>>; aspectRatio: number }> {
  if (_cachedLogoImage) {
    return { image: _cachedLogoImage, aspectRatio: _cachedLogoAspectRatio };
  }

  const logoFile = new FSFile(logoUri);
  if (!logoFile.exists) {
    throw new Error('Logo file not found');
  }

  // Read the logo file bytes
  const base64 = logoFile.text(); // expo-file-system reads as text
  // For binary files, we need to read as base64 and decode
  const logoData = Skia.Data.fromURI(logoUri);
  const logoImage = Skia.Image.MakeImageFromEncoded(logoData);

  if (!logoImage) {
    throw new Error('Failed to decode logo image');
  }

  _cachedLogoImage = logoImage;
  _cachedLogoAspectRatio = logoImage.width() / logoImage.height();

  return { image: logoImage, aspectRatio: _cachedLogoAspectRatio };
}

/**
 * Get the cached logo aspect ratio, or the fallback (2.5).
 */
export function getLogoAspectRatio(): number {
  return _cachedLogoAspectRatio;
}

// ---------------------------------------------------------------------------
// Watermark applicator
// ---------------------------------------------------------------------------

/**
 * Apply a watermark logo overlay to an image using Skia Canvas rendering.
 *
 * Pipeline: optimize (resize+compress) → **watermark (this function)** → upload
 *
 * The input image is already optimized. This function composites the logo
 * on top at the position/size/opacity specified by the WatermarkDraft,
 * then encodes the result as JPEG and saves to a temp file.
 *
 * Falls back to the original image URI on any error.
 *
 * @param imageUri   Local file URI of the (already optimized) image.
 * @param draft      Watermark positioning from the editor.
 * @param logoUri    Local file URI of the bundled logo asset.
 * @returns          Result with the watermarked image URI, or original on failure/skip.
 */
export async function applyWatermarkToImage(
  imageUri: string,
  draft: WatermarkDraft,
  logoUri: string,
): Promise<WatermarkResult> {
  // Skip if watermark disabled
  if (draft.noWatermarkNeeded) {
    return { uri: imageUri, applied: false };
  }

  // Validate input paths
  if (!validateSafePath(imageUri) || !validateSafePath(logoUri)) {
    return { uri: imageUri, applied: false };
  }

  try {
    // Load source image
    const sourceData = Skia.Data.fromURI(imageUri);
    const sourceImage = Skia.Image.MakeImageFromEncoded(sourceData);
    if (!sourceImage) {
      console.error('[watermark] Failed to decode source image');
      return { uri: imageUri, applied: false };
    }

    const imageWidth = sourceImage.width();
    const imageHeight = sourceImage.height();

    // Load logo
    const { image: logoImage, aspectRatio } = await loadLogo(logoUri);

    // Calculate pixel positions
    const pixels = calculateWatermarkPixels(draft, imageWidth, imageHeight, aspectRatio);

    // Create an offscreen surface and draw
    const surface = Skia.Surface.MakeOffscreen(imageWidth, imageHeight)!;
    if (!surface) {
      console.error('[watermark] Failed to create offscreen surface');
      return { uri: imageUri, applied: false };
    }

    const canvas = surface.getCanvas();

    // Draw the source image
    const srcPaint = Skia.Paint();
    canvas.drawImage(sourceImage, 0, 0, srcPaint);

    // Draw the logo with opacity
    const logoPaint = Skia.Paint();
    logoPaint.setAlphaf(pixels.opacity);

    const destRect = Skia.XYWHRect(pixels.x, pixels.y, pixels.logoWidth, pixels.logoHeight);
    const srcRect = Skia.XYWHRect(0, 0, logoImage.width(), logoImage.height());
    canvas.drawImageRect(logoImage, srcRect, destRect, logoPaint);

    // Flush and encode
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    if (!snapshot) {
      console.error('[watermark] Failed to capture snapshot');
      return { uri: imageUri, applied: false };
    }

    const encodedData = snapshot.encodeToBytes();
    if (!encodedData) {
      console.error('[watermark] Failed to encode watermarked image');
      return { uri: imageUri, applied: false };
    }

    // Save to temp file
    const outputFile = new FSFile(Paths.cache, `wm_${Date.now()}.jpg`);
    if (outputFile.exists) {
      try { outputFile.delete(); } catch { /* ignore */ }
    }
    outputFile.write(encodedData);

    return { uri: outputFile.uri, applied: true };
  } catch (error) {
    console.error('[watermark] Watermark application failed:', error);
    return { uri: imageUri, applied: false };
  }
}

/**
 * Reset the cached logo image. Useful for testing.
 */
export function resetLogoCache(): void {
  _cachedLogoImage = null;
  _cachedLogoAspectRatio = 2.5;
}
