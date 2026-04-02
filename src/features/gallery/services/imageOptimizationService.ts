import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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

/** JPEG/WebP quality (0–1 scale for expo-image-manipulator). Flutter uses 65/100. */
const WEBP_COMPRESS = 0.65;

/** PNG is lossless — use quality 1.0. */
const PNG_COMPRESS = 1.0;

/** Map of input extensions to target save format. */
const FORMAT_MAP: Record<string, SaveFormat> = {
  jpg: SaveFormat.WEBP,
  jpeg: SaveFormat.WEBP,
  heic: SaveFormat.WEBP,
  heif: SaveFormat.WEBP,
  png: SaveFormat.PNG,
};

/**
 * Extract the file extension (lowercase, no dot) from a URI or path.
 */
function getExtension(uri: string): string {
  const lastDot = uri.lastIndexOf('.');
  if (lastDot === -1) return '';
  // Strip query params if present
  const ext = uri.substring(lastDot + 1).split(/[?#]/)[0];
  return ext.toLowerCase();
}

/**
 * Optimize an image: resize to max 2048px on the longest edge,
 * compress JPEG/HEIC to WebP at 65% quality, keep PNG as PNG.
 *
 * If the optimized file is not smaller than the original, returns
 * the original file URI (optimization skipped).
 *
 * Mirrors Flutter's `ImageOptimizationService.optimizeImage`.
 */
export async function optimizeImage(uri: string): Promise<ImageOptimizationResult> {
  const ext = getExtension(uri);
  const targetFormat = FORMAT_MAP[ext];

  const originalFile = new FSFile(uri);
  const originalSize = originalFile.size;

  // Unknown format — skip optimization
  if (!targetFormat) {
    return {
      uri,
      wasOptimized: false,
      originalSize,
      optimizedSize: originalSize,
    };
  }

  const compress = targetFormat === SaveFormat.WEBP ? WEBP_COMPRESS : PNG_COMPRESS;

  try {
    // Use the new object-oriented API: manipulate → resize → render → save
    const context = ImageManipulator.manipulate(uri);
    const imageRef = await context
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION })
      .renderAsync();

    const outExt = targetFormat === SaveFormat.WEBP ? 'webp' : 'png';
    const result = await imageRef.saveAsync({
      format: targetFormat,
      compress,
    });

    // Check if the optimized file is actually smaller
    const optimizedFile = new FSFile(result.uri);
    const optimizedSize = optimizedFile.size;

    if (optimizedSize >= originalSize) {
      // Not worth it — clean up and return original
      try { optimizedFile.delete(); } catch { /* ignore */ }
      return {
        uri,
        wasOptimized: false,
        originalSize,
        optimizedSize: originalSize,
      };
    }

    // Rename to a predictable path in cache for cleanup tracking.
    // Strip path separators and null bytes to prevent path traversal.
    const rawBaseName = uri.substring(uri.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    const baseName = rawBaseName.replace(/[/\\\0]/g, '_').slice(0, 200);
    const destFile = new FSFile(Paths.cache, `optimized_${baseName}.${outExt}`);
    if (destFile.exists) {
      try { destFile.delete(); } catch { /* ignore */ }
    }
    optimizedFile.move(destFile);

    return {
      uri: destFile.uri,
      wasOptimized: true,
      originalSize,
      optimizedSize,
    };
  } catch {
    // On any error, fall back to original
    return {
      uri,
      wasOptimized: false,
      originalSize,
      optimizedSize: originalSize,
    };
  }
}
