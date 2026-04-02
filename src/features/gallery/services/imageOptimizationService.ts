import { Image } from 'react-native-compressor';
import { File as FSFile, Paths } from 'expo-file-system';

/**
 * Result of optimizing a single image.
 * Mirrors Flutter's `ImageOptimizationResult`.
 */
export interface ImageOptimizationResult {
  /** URI of the output file (original if not optimized). */
  uri: string;
  /** Whether the image was actually optimized (compressed smaller). */
  wasOptimized: boolean;
  /** Original file size in bytes. */
  originalSize: number;
  /** Optimized file size in bytes (same as original if not optimized). */
  optimizedSize: number;
}

/** Max dimension on the longest edge. */
const MAX_DIMENSION = 2048;

/**
 * JPEG quality (0–1 scale). Flutter uses 65/100.
 * react-native-compressor uses 0–1 for quality.
 */
const JPEG_QUALITY = 0.65;

/** Extensions we know how to compress (lossy → JPEG, lossless → PNG). */
const LOSSY_EXTS = new Set(['jpg', 'jpeg', 'heic', 'heif']);
const LOSSLESS_EXTS = new Set(['png']);

/**
 * Extract the file extension (lowercase, no dot) from a URI or path.
 */
function getExtension(uri: string): string {
  const lastDot = uri.lastIndexOf('.');
  if (lastDot === -1) return '';
  const ext = uri.substring(lastDot + 1).split(/[?#]/)[0];
  return ext.toLowerCase();
}

/**
 * Optimize an image using GPU-accelerated native compression
 * (react-native-compressor). Runs on a native background thread —
 * never blocks the JS thread.
 *
 * - JPEG/HEIC → compressed JPEG at 65% quality, max 2048px
 * - PNG → compressed PNG, max 2048px
 * - Unknown format → returned as-is
 *
 * If the optimized file is not smaller than the original, returns
 * the original file URI (optimization skipped).
 *
 * Mirrors Flutter's `ImageOptimizationService.optimizeImage`.
 */
export async function optimizeImage(uri: string): Promise<ImageOptimizationResult> {
  // Defense-in-depth: only allow local file URIs. Reject network or crafted schemes.
  if (!uri.startsWith('file://') && !uri.startsWith('/')) {
    return { uri, wasOptimized: false, originalSize: 0, optimizedSize: 0 };
  }

  const ext = getExtension(uri);
  const isLossy = LOSSY_EXTS.has(ext);
  const isLossless = LOSSLESS_EXTS.has(ext);

  const originalFile = new FSFile(uri);
  const originalSize = originalFile.size;

  // Unknown format — skip optimization
  if (!isLossy && !isLossless) {
    return {
      uri,
      wasOptimized: false,
      originalSize,
      optimizedSize: originalSize,
    };
  }

  try {
    // react-native-compressor Image.compress runs on a native background thread.
    // Uses hardware-accelerated Bitmap scaling on Android, Core Image on iOS.
    const compressedUri = await Image.compress(uri, {
      compressionMethod: 'manual',
      maxWidth: MAX_DIMENSION,
      maxHeight: MAX_DIMENSION,
      quality: isLossy ? JPEG_QUALITY : 1,
      output: isLossless ? 'png' : 'jpg',
    });

    // Check if the optimized file is actually smaller
    const compressedFile = new FSFile(compressedUri);
    const optimizedSize = compressedFile.size;

    // Move compressed file to a predictable cache path regardless of whether
    // it's smaller.  react-native-compressor on Android may consume/delete the
    // source file during compression, so we can never assume the original URI
    // is still valid after Image.compress returns.
    const rawBaseName = uri.substring(uri.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    const baseName = rawBaseName.replace(/[/\\\0]/g, '_').slice(0, 200);
    const outExt = isLossless ? 'png' : 'jpg';
    const destFile = new FSFile(Paths.cache, `optimized_${baseName}_${Date.now()}.${outExt}`);
    if (destFile.exists) {
      try { destFile.delete(); } catch { /* ignore */ }
    }
    compressedFile.move(destFile);

    const wasOptimized = optimizedSize < originalSize;

    return {
      uri: destFile.uri,
      wasOptimized,
      originalSize,
      optimizedSize: wasOptimized ? optimizedSize : originalSize,
    };
  } catch {
    // On any error, fall back to original — but verify it still exists.
    // react-native-compressor may have consumed/moved it before throwing.
    const origStillExists = new FSFile(uri).exists;
    if (!origStillExists) {
      // Original is gone and compression failed — nothing we can do.
      // Return the URI anyway; the pipeline's file-existence check in
      // uploadItem will catch it and log a clear message.
    }
    return {
      uri,
      wasOptimized: false,
      originalSize,
      optimizedSize: originalSize,
    };
  }
}
