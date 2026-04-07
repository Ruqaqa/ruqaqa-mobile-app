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
function isSkiaObjectValid(obj: unknown): boolean {
  try {
    // Attempt to call a method on the Skia image — if the native HostObject
    // has been freed (e.g. after backgrounding), this throws.
    if (obj && typeof (obj as any).width === 'function') {
      (obj as any).width();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function loadLogo(
  logoUri: string,
): Promise<{ image: NonNullable<ReturnType<typeof Skia.Image.MakeImageFromEncoded>>; aspectRatio: number }> {
  // Return cached logo if still valid
  if (_cachedLogoImage) {
    console.log('[watermark:debug] loadLogo: cache hit, checking validity...');
    const valid = isSkiaObjectValid(_cachedLogoImage);
    console.log('[watermark:debug] loadLogo: cached logo valid:', valid);
    if (valid) {
      console.log('[watermark:debug] loadLogo: returning cached logo, aspectRatio:', _cachedLogoAspectRatio);
      return { image: _cachedLogoImage, aspectRatio: _cachedLogoAspectRatio };
    }
    console.log('[watermark:debug] loadLogo: cached logo is STALE, reloading...');
  } else {
    console.log('[watermark:debug] loadLogo: cache miss, loading fresh logo from:', logoUri);
  }

  // Cache is stale or empty — reload
  _cachedLogoImage = null;

  console.log('[watermark:debug] loadLogo Step 1: Checking logo file existence at:', logoUri);
  const logoFile = new FSFile(logoUri);
  console.log('[watermark:debug] loadLogo: logoFile.exists:', logoFile.exists);
  if (!logoFile.exists) {
    throw new Error('Logo file not found');
  }

  console.log('[watermark:debug] loadLogo Step 2: Skia.Data.fromURI(logoUri)');
  let logoData;
  try {
    logoData = await Skia.Data.fromURI(logoUri);
    console.log('[watermark:debug] loadLogo: logoData type:', typeof logoData, 'truthy:', !!logoData);
  } catch (e) {
    console.error('[watermark:debug] loadLogo: FAILED Skia.Data.fromURI for logo:', e);
    throw e;
  }

  console.log('[watermark:debug] loadLogo Step 4: Decoding logo image via Skia.Image.MakeImageFromEncoded');
  let logoImage;
  try {
    logoImage = Skia.Image.MakeImageFromEncoded(logoData);
    console.log('[watermark:debug] loadLogo: logoImage type:', typeof logoImage, 'truthy:', !!logoImage);
  } catch (e) {
    console.error('[watermark:debug] loadLogo: FAILED Skia.Image.MakeImageFromEncoded for logo:', e);
    throw e;
  }

  if (!logoImage) {
    throw new Error('Failed to decode logo image');
  }

  console.log('[watermark:debug] loadLogo Step 5: Reading logo dimensions');
  let logoWidth: number;
  let logoHeight: number;
  try {
    logoWidth = logoImage.width();
    logoHeight = logoImage.height();
    console.log('[watermark:debug] loadLogo: logo dimensions:', logoWidth, 'x', logoHeight);
  } catch (e) {
    console.error('[watermark:debug] loadLogo: FAILED reading logo dimensions:', e);
    throw e;
  }

  _cachedLogoImage = logoImage;
  _cachedLogoAspectRatio = logoWidth / logoHeight;
  console.log('[watermark:debug] loadLogo: cached logo, aspectRatio:', _cachedLogoAspectRatio);

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
  console.log('[watermark:debug] === applyWatermarkToImage called ===');
  console.log('[watermark:debug] imageUri:', imageUri);
  console.log('[watermark:debug] logoUri:', logoUri);
  console.log('[watermark:debug] draft:', JSON.stringify(draft));

  // Skip if watermark disabled
  if (draft.noWatermarkNeeded) {
    console.log('[watermark:debug] Skipping: noWatermarkNeeded is true');
    return { uri: imageUri, applied: false };
  }

  // Validate input paths
  if (!validateSafePath(imageUri) || !validateSafePath(logoUri)) {
    console.log('[watermark:debug] Skipping: path validation failed. imageUri valid:', validateSafePath(imageUri), 'logoUri valid:', validateSafePath(logoUri));
    return { uri: imageUri, applied: false };
  }

  try {
    // Step 1: Read source file
    console.log('[watermark:debug] Step 1: Checking source file at:', imageUri);
    const sourceFile = new FSFile(imageUri);
    console.log('[watermark:debug] sourceFile.exists:', sourceFile.exists);
    if (!sourceFile.exists) {
      console.error('[watermark] Source file does not exist:', imageUri);
      return { uri: imageUri, applied: false };
    }

    // Step 2: Create Skia Data from source URI
    console.log('[watermark:debug] Step 2: Skia.Data.fromURI(imageUri)');
    let sourceData;
    try {
      sourceData = await Skia.Data.fromURI(imageUri);
      console.log('[watermark:debug] sourceData type:', typeof sourceData, 'truthy:', !!sourceData);
    } catch (e) {
      console.error('[watermark:debug] FAILED Skia.Data.fromURI(imageUri):', e);
      return { uri: imageUri, applied: false };
    }

    // Step 4: Decode source image
    console.log('[watermark:debug] Step 4: Skia.Image.MakeImageFromEncoded(sourceData)');
    let sourceImage;
    try {
      sourceImage = Skia.Image.MakeImageFromEncoded(sourceData);
      console.log('[watermark:debug] sourceImage type:', typeof sourceImage, 'truthy:', !!sourceImage);
    } catch (e) {
      console.error('[watermark:debug] FAILED Skia.Image.MakeImageFromEncoded(sourceData):', e);
      return { uri: imageUri, applied: false };
    }
    if (!sourceImage) {
      console.error('[watermark] Failed to decode source image');
      return { uri: imageUri, applied: false };
    }

    // Step 5: Read source image dimensions
    console.log('[watermark:debug] Step 5: Reading source image dimensions');
    let imageWidth: number;
    let imageHeight: number;
    try {
      imageWidth = sourceImage.width();
      imageHeight = sourceImage.height();
      console.log('[watermark:debug] Source image dimensions:', imageWidth, 'x', imageHeight);
    } catch (e) {
      console.error('[watermark:debug] FAILED reading source image dimensions:', e);
      return { uri: imageUri, applied: false };
    }

    // Step 6: Load logo
    console.log('[watermark:debug] Step 6: Loading logo from:', logoUri);
    let logoImage;
    let aspectRatio: number;
    try {
      const logoResult = await loadLogo(logoUri);
      logoImage = logoResult.image;
      aspectRatio = logoResult.aspectRatio;
      console.log('[watermark:debug] Logo loaded, aspectRatio:', aspectRatio, 'logoImage truthy:', !!logoImage);
    } catch (e) {
      console.error('[watermark:debug] FAILED loadLogo:', e);
      return { uri: imageUri, applied: false };
    }

    // Step 7: Calculate pixel positions
    console.log('[watermark:debug] Step 7: Calculating watermark pixels from draft:', JSON.stringify(draft));
    const pixels = calculateWatermarkPixels(draft, imageWidth, imageHeight, aspectRatio);
    console.log('[watermark:debug] Watermark pixels:', JSON.stringify(pixels));

    // Step 8: Create offscreen surface
    console.log('[watermark:debug] Step 8: Skia.Surface.MakeOffscreen(', imageWidth, ',', imageHeight, ')');
    let surface;
    try {
      surface = Skia.Surface.MakeOffscreen(imageWidth, imageHeight);
      console.log('[watermark:debug] surface type:', typeof surface, 'truthy:', !!surface);
    } catch (e) {
      console.error('[watermark:debug] FAILED Skia.Surface.MakeOffscreen:', e);
      return { uri: imageUri, applied: false };
    }
    if (!surface) {
      console.error('[watermark] Failed to create offscreen surface');
      return { uri: imageUri, applied: false };
    }

    // Step 9: Get canvas
    console.log('[watermark:debug] Step 9: surface.getCanvas()');
    let canvas;
    try {
      canvas = surface.getCanvas();
      console.log('[watermark:debug] canvas type:', typeof canvas, 'truthy:', !!canvas);
    } catch (e) {
      console.error('[watermark:debug] FAILED surface.getCanvas():', e);
      return { uri: imageUri, applied: false };
    }

    // Step 10: Create source paint
    console.log('[watermark:debug] Step 10: Creating source paint via Skia.Paint()');
    let srcPaint;
    try {
      srcPaint = Skia.Paint();
      console.log('[watermark:debug] srcPaint type:', typeof srcPaint, 'truthy:', !!srcPaint);
    } catch (e) {
      console.error('[watermark:debug] FAILED Skia.Paint() for source:', e);
      return { uri: imageUri, applied: false };
    }

    // Step 11: Draw source image onto canvas
    console.log('[watermark:debug] Step 11: canvas.drawImage(sourceImage, 0, 0, srcPaint)');
    try {
      canvas.drawImage(sourceImage, 0, 0, srcPaint);
      console.log('[watermark:debug] drawImage succeeded');
    } catch (e) {
      console.error('[watermark:debug] FAILED canvas.drawImage(sourceImage):', e);
      return { uri: imageUri, applied: false };
    }

    // Step 12: Create logo paint with opacity
    console.log('[watermark:debug] Step 12: Creating logo paint with opacity:', pixels.opacity);
    let logoPaint;
    try {
      logoPaint = Skia.Paint();
      logoPaint.setAlphaf(pixels.opacity);
      console.log('[watermark:debug] logoPaint created and opacity set');
    } catch (e) {
      console.error('[watermark:debug] FAILED creating logo paint / setAlphaf:', e);
      return { uri: imageUri, applied: false };
    }

    // Step 13: Create dest and src rects
    console.log('[watermark:debug] Step 13: Creating XYWHRects for logo');
    let destRect;
    let srcRect;
    try {
      destRect = Skia.XYWHRect(pixels.x, pixels.y, pixels.logoWidth, pixels.logoHeight);
      console.log('[watermark:debug] destRect:', JSON.stringify(destRect));
    } catch (e) {
      console.error('[watermark:debug] FAILED Skia.XYWHRect (destRect):', e);
      return { uri: imageUri, applied: false };
    }
    try {
      const logoW = logoImage.width();
      const logoH = logoImage.height();
      console.log('[watermark:debug] logoImage dimensions for srcRect:', logoW, 'x', logoH);
      srcRect = Skia.XYWHRect(0, 0, logoW, logoH);
      console.log('[watermark:debug] srcRect:', JSON.stringify(srcRect));
    } catch (e) {
      console.error('[watermark:debug] FAILED reading logoImage dimensions / Skia.XYWHRect (srcRect):', e);
      return { uri: imageUri, applied: false };
    }

    // Step 14: Draw logo image rect
    console.log('[watermark:debug] Step 14: canvas.drawImageRect(logoImage, srcRect, destRect, logoPaint)');
    try {
      canvas.drawImageRect(logoImage, srcRect, destRect, logoPaint);
      console.log('[watermark:debug] drawImageRect succeeded');
    } catch (e) {
      console.error('[watermark:debug] FAILED canvas.drawImageRect(logoImage):', e);
      return { uri: imageUri, applied: false };
    }

    // Step 15: Flush surface
    console.log('[watermark:debug] Step 15: surface.flush()');
    try {
      surface.flush();
      console.log('[watermark:debug] surface.flush() succeeded');
    } catch (e) {
      console.error('[watermark:debug] FAILED surface.flush():', e);
      return { uri: imageUri, applied: false };
    }

    // Step 16: Make image snapshot
    console.log('[watermark:debug] Step 16: surface.makeImageSnapshot()');
    let snapshot;
    try {
      snapshot = surface.makeImageSnapshot();
      console.log('[watermark:debug] snapshot type:', typeof snapshot, 'truthy:', !!snapshot);
    } catch (e) {
      console.error('[watermark:debug] FAILED surface.makeImageSnapshot():', e);
      return { uri: imageUri, applied: false };
    }
    if (!snapshot) {
      console.error('[watermark] Failed to capture snapshot');
      return { uri: imageUri, applied: false };
    }

    // Step 17: Encode snapshot to bytes
    console.log('[watermark:debug] Step 17: snapshot.encodeToBytes()');
    let encodedData;
    try {
      encodedData = snapshot.encodeToBytes();
      console.log('[watermark:debug] encodedData type:', typeof encodedData, 'truthy:', !!encodedData, 'length:', encodedData?.length);
    } catch (e) {
      console.error('[watermark:debug] FAILED snapshot.encodeToBytes():', e);
      return { uri: imageUri, applied: false };
    }
    if (!encodedData) {
      console.error('[watermark] Failed to encode watermarked image');
      return { uri: imageUri, applied: false };
    }

    // Step 18: Save to temp file
    console.log('[watermark:debug] Step 18: Writing watermarked image to temp file');
    const outputFile = new FSFile(Paths.cache, `wm_${Date.now()}.jpg`);
    if (outputFile.exists) {
      try { outputFile.delete(); } catch { /* ignore */ }
    }
    outputFile.write(encodedData);
    console.log('[watermark:debug] Watermarked image saved to:', outputFile.uri);

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
