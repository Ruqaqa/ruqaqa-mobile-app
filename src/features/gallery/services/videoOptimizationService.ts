import { Video, createVideoThumbnail } from 'react-native-compressor';
import { File as FSFile, Paths } from 'expo-file-system';

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

// ---------------------------------------------------------------------------
// Cancellation support
// ---------------------------------------------------------------------------

/** Tracks the cancellation ID of the current compression. */
let _currentCancellationId: string | undefined;

/**
 * Cancel the currently running video compression, if any.
 * Safe to call even if no compression is running.
 */
export async function cancelVideoCompression(): Promise<void> {
  if (_currentCancellationId) {
    try {
      await Video.cancelCompression(_currentCancellationId);
    } catch { /* ignore — may already be finished */ }
    _currentCancellationId = undefined;
  }
}

// ---------------------------------------------------------------------------
// Video optimization
// ---------------------------------------------------------------------------

/**
 * Compress a video using GPU-accelerated hardware encoding.
 *
 * - Android: MediaCodec (hardware H.264 encoder)
 * - iOS: AVAssetExportSession / VideoToolbox (hardware H.264/H.265)
 *
 * Runs entirely on native background threads — never blocks the JS thread.
 * Uses streaming architecture: the native encoder reads frames incrementally,
 * so even 500MB+ videos won't cause OOM kills.
 *
 * @param uri       File URI of the input video.
 * @param onProgress Optional callback receiving progress 0–1.
 * @returns Optimization result with the output URI.
 */
export async function optimizeVideo(
  uri: string,
  onProgress?: (progress: number) => void,
): Promise<VideoOptimizationResult> {
  // Defense-in-depth: only allow local file URIs. Reject network or crafted schemes.
  if (!uri.startsWith('file://') && !uri.startsWith('/')) {
    return { uri, wasOptimized: false, originalSize: 0, optimizedSize: 0 };
  }

  const originalFile = new FSFile(uri);
  const originalSize = originalFile.size;

  // Reset cancellation state for this run
  _currentCancellationId = undefined;

  try {
    const compressedUri = await Video.compress(
      uri,
      {
        compressionMethod: 'auto',
        minimumFileSizeForCompress: 0,
      },
      (progress: number) => {
        onProgress?.(progress);
      },
      (id: string) => {
        _currentCancellationId = id;
      },
    );

    const compressedFile = new FSFile(compressedUri);
    const optimizedSize = compressedFile.size;

    if (optimizedSize >= originalSize) {
      // Compression didn't help — clean up and return original
      try { compressedFile.delete(); } catch { /* ignore */ }
      return {
        uri,
        wasOptimized: false,
        originalSize,
        optimizedSize: originalSize,
      };
    }

    // Move to a predictable cache path for cleanup tracking.
    // Strip path separators and null bytes to prevent path traversal.
    const rawBaseName = uri.substring(uri.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    const baseName = rawBaseName.replace(/[/\\\0]/g, '_').slice(0, 200);
    const destFile = new FSFile(Paths.cache, `optimized_${baseName}.mp4`);
    if (destFile.exists) {
      try { destFile.delete(); } catch { /* ignore */ }
    }
    compressedFile.move(destFile);

    return {
      uri: destFile.uri,
      wasOptimized: true,
      originalSize,
      optimizedSize,
    };
  } catch {
    // On any error (including cancellation), fall back to original
    return {
      uri,
      wasOptimized: false,
      originalSize,
      optimizedSize: originalSize,
    };
  } finally {
    _currentCancellationId = undefined;
  }
}

// ---------------------------------------------------------------------------
// Thumbnail generation
// ---------------------------------------------------------------------------

/**
 * Generate a thumbnail from a video.
 * Returns the URI of the generated JPEG thumbnail, or null on failure.
 *
 * Mirrors Flutter's `VideoProcessingService.generateThumbnail`.
 */
export async function generateVideoThumbnail(uri: string): Promise<string | null> {
  // Only allow local file URIs
  if (!uri.startsWith('file://') && !uri.startsWith('/')) return null;

  try {
    const result = await createVideoThumbnail(uri);
    return result?.path ?? null;
  } catch {
    return null;
  }
}
