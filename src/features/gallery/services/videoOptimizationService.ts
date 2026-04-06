import { Skia } from '@shopify/react-native-skia';
import { File as FSFile, Paths } from 'expo-file-system';
import {
  execute,
  cancel as ffmpegCancel,
  getMediaInfo,
  buildWatermarkCommand,
  buildCompressCommand,
  buildExtractThumbnailCommand,
  getPreferredEncoder,
  getErrorCode,
  FFmpegErrorCode,
} from 'expo-ffmpeg';
import type { ProgressData, WatermarkOptions, CompressOptions } from 'expo-ffmpeg';
import type { WatermarkDraft } from '../types';
import { clampWatermarkDraft } from '../types';
import { validateSafePath } from '../utils/watermarkValidation';

/**
 * Result of optimizing a single video.
 * Mirrors Flutter's `VideoOptimizationResult`.
 */
export interface VideoOptimizationResult {
  /** URI of the output file (original if not optimized). */
  uri: string;
  /** Whether the video was actually optimized (compressed smaller). */
  wasOptimized: boolean;
  /** Original file size in bytes. */
  originalSize: number;
  /** Optimized file size in bytes (same as original if not optimized). */
  optimizedSize: number;
}

/**
 * Convert a file:// URI to an absolute path for FFmpeg.
 * FFmpeg expects raw filesystem paths, not file:// URIs.
 */
function toAbsolutePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.replace('file://', ''));
  }
  return uri;
}

// ---------------------------------------------------------------------------
// Cancellation support
// ---------------------------------------------------------------------------

/** Whether a video operation is currently running. */
let _isProcessing = false;

/**
 * Cancel the currently running video compression, if any.
 * Safe to call even if no compression is running.
 */
export function cancelVideoCompression(): void {
  if (_isProcessing) {
    ffmpegCancel();
  }
}

// ---------------------------------------------------------------------------
// Video compression — compress-only FFmpeg pass
// ---------------------------------------------------------------------------

/**
 * Compress a video using GPU-accelerated FFmpeg encoding.
 * This is compression-only — no watermark overlay.
 *
 * - iOS: h264_videotoolbox (GPU hardware encoder)
 * - Android: h264_mediacodec (GPU hardware encoder)
 * - Fallback: libx264 (CPU software encoder)
 *
 * Runs entirely on native background threads — never blocks the JS thread.
 *
 * @param uri            File URI of the input video.
 * @param onProgress     Optional callback receiving progress 0–1.
 * @returns              Optimization result with the output URI.
 */
export async function optimizeVideo(
  uri: string,
  onProgress?: (progress: number) => void,
): Promise<VideoOptimizationResult> {
  // Defense-in-depth: only allow local file URIs
  if (!validateSafePath(uri)) {
    return { uri, wasOptimized: false, originalSize: 0, optimizedSize: 0 };
  }

  const originalFile = new FSFile(uri);
  const originalSize = originalFile.size;

  _isProcessing = true;

  try {
    const inputPath = toAbsolutePath(uri);

    // Generate unique output path
    const rawBaseName = uri.substring(uri.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    const baseName = rawBaseName.replace(/[/\\\0]/g, '_').slice(0, 200);
    const outputFile = new FSFile(Paths.cache, `ffmpeg_${baseName}_${Date.now()}.mp4`);
    if (outputFile.exists) {
      try { outputFile.delete(); } catch { /* ignore */ }
    }
    const outputPath = toAbsolutePath(outputFile.uri);

    const encoder = getPreferredEncoder();

    // Map FFmpeg progress (0-100) to pipeline progress (0-1)
    const progressCallback = onProgress
      ? (data: ProgressData) => { onProgress(data.percentage / 100); }
      : undefined;

    // Compression only (no watermark)
    const options: CompressOptions = {
      encoder,
      threads: 2,
    };

    const command = buildCompressCommand(inputPath, outputPath, options);

    // Execute FFmpeg — try hardware encoder first
    let result = await execute(command, progressCallback, { timeout: 600_000 });

    // If hardware encoder failed, retry with software fallback
    if (result.returnCode !== 0 && encoder !== 'libx264') {
      console.warn('[video] Hardware encoder failed, retrying with libx264');

      // Clean up failed output
      if (outputFile.exists) {
        try { outputFile.delete(); } catch { /* ignore */ }
      }

      const fallbackCommand = buildCompressCommand(inputPath, outputPath, {
        encoder: 'libx264',
        crf: 23,
        preset: 'fast',
        threads: 2,
      });

      result = await execute(fallbackCommand, progressCallback, { timeout: 600_000 });
    }

    if (result.returnCode !== 0) {
      const errorCode = getErrorCode(result.output);
      if (errorCode === FFmpegErrorCode.CANCELLED) {
        console.log('[video] Processing cancelled by user');
      } else {
        console.error('[video] FFmpeg failed with code', result.returnCode);
      }
      // Clean up failed output
      if (outputFile.exists) {
        try { outputFile.delete(); } catch { /* ignore */ }
      }
      return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
    }

    // Check output size
    if (!outputFile.exists) {
      return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
    }

    const optimizedSize = outputFile.size;

    // If output is larger than input, discard and return original
    if (optimizedSize >= originalSize) {
      try { outputFile.delete(); } catch { /* ignore */ }
      return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
    }

    return {
      uri: outputFile.uri,
      wasOptimized: true,
      originalSize,
      optimizedSize,
    };
  } catch (error) {
    console.error('[video] Video compression failed:', error);
    return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
  } finally {
    _isProcessing = false;
  }
}

// ---------------------------------------------------------------------------
// Logo pre-processing — bake opacity into the PNG using Skia
// ---------------------------------------------------------------------------

/**
 * Create a copy of the logo PNG with opacity pre-applied using Skia.
 *
 * The FFmpeg binary is compiled with a minimal filter set (overlay, scale only).
 * The `format` and `colorchannelmixer` filters needed for runtime opacity
 * adjustment are NOT available. Instead, we bake the opacity into the logo
 * image on the JS side before passing it to FFmpeg.
 *
 * @param logoUri  Local file URI of the original logo.
 * @param opacity  Desired opacity (0–1).
 * @returns        URI of a temp PNG with opacity pre-applied, or null on failure.
 */
function prepareLogoWithOpacity(logoUri: string, opacity: number): string | null {
  try {
    // Read logo bytes via expo-file-system rather than Skia.Data.fromURI,
    // which fails with HostObject errors on Expo asset cache paths.
    const logoFile = new FSFile(logoUri);
    if (!logoFile.exists) {
      console.error('[video:wm] Logo file not found for opacity pre-processing');
      return null;
    }
    const logoBytes = logoFile.bytesSync();
    const logoData = Skia.Data.fromBytes(logoBytes);
    const logoImage = Skia.Image.MakeImageFromEncoded(logoData);
    if (!logoImage) {
      console.error('[video:wm] Failed to decode logo for opacity pre-processing');
      return null;
    }

    const w = logoImage.width();
    const h = logoImage.height();

    const surface = Skia.Surface.MakeOffscreen(w, h);
    if (!surface) {
      console.error('[video:wm] Failed to create offscreen surface for logo');
      return null;
    }

    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color(0, 0, 0, 0)); // transparent background

    const paint = Skia.Paint();
    paint.setAlphaf(opacity);
    canvas.drawImage(logoImage, 0, 0, paint);

    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    if (!snapshot) {
      console.error('[video:wm] Failed to snapshot logo surface');
      return null;
    }

    const encoded = snapshot.encodeToBytes();
    if (!encoded) {
      console.error('[video:wm] Failed to encode logo PNG');
      return null;
    }

    const tempFile = new FSFile(Paths.cache, `wm_logo_${Date.now()}.png`);
    if (tempFile.exists) {
      try { tempFile.delete(); } catch { /* ignore */ }
    }
    tempFile.write(encoded);

    console.log('[video:wm] Pre-processed logo with opacity', opacity, '→', tempFile.uri);
    return tempFile.uri;
  } catch (error) {
    console.error('[video:wm] Logo opacity pre-processing failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video watermarking — separate FFmpeg pass
// ---------------------------------------------------------------------------

/**
 * Apply a watermark overlay to an already-compressed video via FFmpeg.
 * This is a separate pass from compression, enabling dual-variant upload
 * (original compressed + watermarked).
 *
 * @param uri            File URI of the compressed video.
 * @param watermarkDraft Watermark positioning (percentages).
 * @param logoUri        Local file URI of the watermark logo.
 * @param onProgress     Optional callback receiving progress 0–1.
 * @returns              Result with the watermarked output URI.
 */
export async function watermarkVideo(
  uri: string,
  watermarkDraft: WatermarkDraft,
  logoUri: string,
  onProgress?: (progress: number) => void,
): Promise<VideoOptimizationResult> {
  // Defense-in-depth: validate both paths
  if (!validateSafePath(uri) || !validateSafePath(logoUri)) {
    return { uri, wasOptimized: false, originalSize: 0, optimizedSize: 0 };
  }

  const originalFile = new FSFile(uri);
  const originalSize = originalFile.size;

  _isProcessing = true;

  // Track temp files for cleanup
  let preProcessedLogoFile: FSFile | null = null;

  try {
    const inputPath = toAbsolutePath(uri);

    console.log('[video:wm] inputPath:', inputPath);
    console.log('[video:wm] logoUri raw:', logoUri);

    // Check if logo file exists
    const logoFile = new FSFile(logoUri);
    console.log('[video:wm] logo exists:', logoFile.exists, 'size:', logoFile.exists ? logoFile.size : 0);

    // Generate unique output path
    const rawBaseName = uri.substring(uri.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    const baseName = rawBaseName.replace(/[/\\\0]/g, '_').slice(0, 200);
    const outputFile = new FSFile(Paths.cache, `ffmpeg_wm_${baseName}_${Date.now()}.mp4`);
    if (outputFile.exists) {
      try { outputFile.delete(); } catch { /* ignore */ }
    }
    const outputPath = toAbsolutePath(outputFile.uri);

    // Get video dimensions for percentage-to-pixel conversion
    const clamped = clampWatermarkDraft(watermarkDraft);
    let videoWidth = 1920;
    let videoHeight = 1080;
    try {
      const info = await getMediaInfo(inputPath);
      if (info.width > 0 && info.height > 0) {
        videoWidth = info.width;
        videoHeight = info.height;
      }
    } catch {
      // Use default dimensions if probe fails
    }

    console.log('[video:wm] video dimensions:', videoWidth, 'x', videoHeight);

    // Convert percentage positions to pixel-based FFmpeg margins
    const marginX = Math.round((clamped.xPct / 100) * videoWidth);
    const marginY = Math.round((clamped.yPct / 100) * videoHeight);
    const opacity = clamped.opacityPct / 100;

    // Pre-process logo with Skia to bake in opacity.
    // The FFmpeg binary only has overlay + scale filters compiled in;
    // the format + colorchannelmixer filters needed for runtime opacity
    // are NOT available. We apply opacity on the JS side instead.
    let effectiveLogoUri = logoUri;
    if (opacity < 1) {
      const preProcessedUri = prepareLogoWithOpacity(logoUri, opacity);
      if (preProcessedUri) {
        effectiveLogoUri = preProcessedUri;
        preProcessedLogoFile = new FSFile(preProcessedUri);
      } else {
        console.warn('[video:wm] Logo opacity pre-processing failed, using original logo');
      }
    }
    const logoPath = toAbsolutePath(effectiveLogoUri);

    // Calculate the correct FFmpeg scale factor.
    // widthPct is "percentage of VIDEO width", but FFmpeg's scale filter
    // applies as iw*factor:ih*factor (relative to the LOGO's own dimensions).
    // So: targetWidth = videoWidth * widthPct/100
    //     factor = targetWidth / logoIntrinsicWidth
    let logoScale = clamped.widthPct / 100; // fallback: treat as logo-relative
    try {
      const logoBytes = new FSFile(effectiveLogoUri).bytesSync();
      const logoData = Skia.Data.fromBytes(logoBytes);
      const logoImage = Skia.Image.MakeImageFromEncoded(logoData);
      if (logoImage) {
        const logoIntrinsicWidth = logoImage.width();
        const targetWidth = videoWidth * (clamped.widthPct / 100);
        logoScale = targetWidth / logoIntrinsicWidth;
        console.log('[video:wm] logo intrinsic width:', logoIntrinsicWidth, 'target:', targetWidth, 'scale factor:', logoScale);
      }
    } catch {
      console.warn('[video:wm] Could not read logo dimensions, using widthPct as-is');
    }

    const encoder = getPreferredEncoder();

    // Map FFmpeg progress (0-100) to pipeline progress (0-1)
    const progressCallback = onProgress
      ? (data: ProgressData) => { onProgress(data.percentage / 100); }
      : undefined;

    // Note: opacity is NOT passed here — it's already baked into the logo PNG.
    // This keeps the filter_complex to only scale + overlay (both compiled in).
    const options: WatermarkOptions = {
      position: 'top-left', // We use absolute positioning via marginX/marginY
      marginX,
      marginY,
      scale: logoScale,
      encoder,
      threads: 2,
    };

    const command = buildWatermarkCommand(inputPath, logoPath, outputPath, options);
    console.log('[video:wm] FFmpeg command:', command);

    // Execute FFmpeg — try hardware encoder first
    let result = await execute(command, progressCallback, { timeout: 600_000 });
    console.log('[video:wm] First attempt returnCode:', result.returnCode, 'output:', result.output?.substring(0, 500));

    // If hardware encoder failed, retry with software fallback
    if (result.returnCode !== 0 && encoder !== 'libx264') {
      console.warn('[video] Hardware encoder failed for watermark, retrying with libx264');

      // Clean up failed output
      if (outputFile.exists) {
        try { outputFile.delete(); } catch { /* ignore */ }
      }

      const fallbackCommand = buildWatermarkCommand(inputPath, logoPath, outputPath, {
        position: 'top-left',
        marginX,
        marginY,
        scale: logoScale,
        encoder: 'libx264',
        crf: 23,
        preset: 'fast',
        threads: 2,
      });

      result = await execute(fallbackCommand, progressCallback, { timeout: 600_000 });
      console.log('[video:wm] Fallback returnCode:', result.returnCode, 'output:', result.output?.substring(0, 500));
    }

    if (result.returnCode !== 0) {
      const errorCode = getErrorCode(result.output);
      if (errorCode === FFmpegErrorCode.CANCELLED) {
        console.log('[video] Watermark cancelled by user');
      } else {
        console.error('[video] FFmpeg watermark failed with code', result.returnCode);
      }
      // Clean up failed output
      if (outputFile.exists) {
        try { outputFile.delete(); } catch { /* ignore */ }
      }
      return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
    }

    // Check output exists
    if (!outputFile.exists) {
      return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
    }

    const optimizedSize = outputFile.size;

    return {
      uri: outputFile.uri,
      wasOptimized: true,
      originalSize,
      optimizedSize,
    };
  } catch (error) {
    console.error('[video] Video watermarking failed:', error);
    return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
  } finally {
    _isProcessing = false;
    // Clean up the pre-processed logo temp file
    if (preProcessedLogoFile) {
      try { if (preProcessedLogoFile.exists) preProcessedLogoFile.delete(); } catch { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Thumbnail generation
// ---------------------------------------------------------------------------

/**
 * Generate a thumbnail from a video using FFmpeg.
 * Extracts a single frame at 1 second as JPEG.
 * Returns the URI of the generated thumbnail, or null on failure.
 */
export async function generateVideoThumbnail(uri: string): Promise<string | null> {
  if (!validateSafePath(uri)) return null;

  try {
    const inputPath = toAbsolutePath(uri);
    const outputFile = new FSFile(Paths.cache, `thumb_${Date.now()}.jpg`);
    const outputPath = toAbsolutePath(outputFile.uri);

    const result = await execute(
      buildExtractThumbnailCommand(inputPath, outputPath, 1),
      undefined,
      { timeout: 30_000 },
    );

    if (result.returnCode === 0 && outputFile.exists) {
      return outputFile.uri;
    }

    return null;
  } catch {
    return null;
  }
}
