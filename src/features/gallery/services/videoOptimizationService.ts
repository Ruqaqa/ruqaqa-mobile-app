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
// Video optimization — single FFmpeg pass
// ---------------------------------------------------------------------------

/**
 * Process a video using GPU-accelerated FFmpeg encoding.
 * Single pass: watermark overlay + H.264 compression (when watermark provided),
 * or compression-only (when no watermark).
 *
 * - iOS: h264_videotoolbox (GPU hardware encoder)
 * - Android: h264_mediacodec (GPU hardware encoder)
 * - Fallback: libx264 (CPU software encoder)
 *
 * Runs entirely on native background threads — never blocks the JS thread.
 *
 * @param uri            File URI of the input video.
 * @param onProgress     Optional callback receiving progress 0–1.
 * @param watermarkDraft Optional watermark positioning. If provided and not
 *                       noWatermarkNeeded, overlays logo in same pass as compress.
 * @param logoUri        Local file URI of the bundled watermark logo.
 * @returns              Optimization result with the output URI.
 */
export async function optimizeVideo(
  uri: string,
  onProgress?: (progress: number) => void,
  watermarkDraft?: WatermarkDraft | null,
  logoUri?: string | null,
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

    // Get video dimensions for watermark pixel calculation
    const needsWatermark = watermarkDraft
      && !watermarkDraft.noWatermarkNeeded
      && logoUri
      && validateSafePath(logoUri);

    const encoder = getPreferredEncoder();

    // Map FFmpeg progress (0-100) to pipeline progress (0-1)
    const progressCallback = onProgress
      ? (data: ProgressData) => { onProgress(data.percentage / 100); }
      : undefined;

    let command: string;

    if (needsWatermark && logoUri) {
      // Single pass: watermark overlay + compress
      const clamped = clampWatermarkDraft(watermarkDraft!);
      const logoPath = toAbsolutePath(logoUri);

      // Get video dimensions for percentage-to-pixel conversion
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

      // Convert percentage positions to pixel-based FFmpeg margins
      const marginX = Math.round((clamped.xPct / 100) * videoWidth);
      const marginY = Math.round((clamped.yPct / 100) * videoHeight);
      const logoScale = clamped.widthPct / 100;
      const opacity = clamped.opacityPct / 100;

      const options: WatermarkOptions = {
        position: 'top-left', // We use absolute positioning via marginX/marginY
        marginX,
        marginY,
        opacity: opacity < 1 ? opacity : undefined,
        scale: logoScale,
        encoder,
        threads: 2,
      };

      command = buildWatermarkCommand(inputPath, logoPath, outputPath, options);
    } else {
      // Compression only (no watermark)
      const options: CompressOptions = {
        encoder,
        threads: 2,
      };

      command = buildCompressCommand(inputPath, outputPath, options);
    }

    // Execute FFmpeg — try hardware encoder first
    let result = await execute(command, progressCallback, { timeout: 600_000 });

    // If hardware encoder failed, retry with software fallback
    if (result.returnCode !== 0 && encoder !== 'libx264') {
      console.warn('[video] Hardware encoder failed, retrying with libx264');

      // Clean up failed output
      if (outputFile.exists) {
        try { outputFile.delete(); } catch { /* ignore */ }
      }

      // Rebuild command from scratch with libx264 (avoids fragile string replace)
      let fallbackCommand: string;
      if (needsWatermark && logoUri) {
        const clamped = clampWatermarkDraft(watermarkDraft!);
        const logoPath = toAbsolutePath(logoUri);
        const marginX = Math.round((clamped.xPct / 100) * 1920);
        const marginY = Math.round((clamped.yPct / 100) * 1080);
        const logoScale = clamped.widthPct / 100;
        const opacity = clamped.opacityPct / 100;
        fallbackCommand = buildWatermarkCommand(inputPath, logoPath, outputPath, {
          position: 'top-left',
          marginX,
          marginY,
          opacity: opacity < 1 ? opacity : undefined,
          scale: logoScale,
          encoder: 'libx264',
          crf: 23,
          preset: 'fast',
          threads: 2,
        });
      } else {
        fallbackCommand = buildCompressCommand(inputPath, outputPath, {
          encoder: 'libx264',
          crf: 23,
          preset: 'fast',
          threads: 2,
        });
      }

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
    console.error('[video] Video processing failed:', error);
    return { uri, wasOptimized: false, originalSize, optimizedSize: originalSize };
  } finally {
    _isProcessing = false;
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
