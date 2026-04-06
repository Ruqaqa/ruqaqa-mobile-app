import ExpoFfmpegModule from './ExpoFfmpegModule';
import { buildExtractThumbnailCommand } from './commands';
import type { ExecutionResult, MediaInfo, ProgressData, ExecuteOptions } from './types';
import { FFmpegErrorCode } from './types';

export { buildWatermarkCommand, buildCompressCommand, buildExtractThumbnailCommand } from './commands';
export { getPreferredEncoder } from './platform';
export {
  FFmpegErrorCode,
} from './types';
export type {
  ExecutionResult,
  MediaInfo,
  ProgressData,
  WatermarkOptions,
  WatermarkPosition,
  CompressOptions,
  ExecuteOptions,
} from './types';

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Delete a file if it exists. Uses expo-file-system when available,
 * falls back silently if not (e.g. in test environments).
 */
function deleteFileIfExists(path: string): void {
  try {
    // Dynamic require to avoid compile-time dependency on expo-file-system
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('expo-file-system/next');
    const file = new fs.File(path);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // expo-file-system may not be available in all environments
  }
}

/**
 * Map native error output strings to structured error codes.
 */
export function getErrorCode(output: string): FFmpegErrorCode {
  if (!output) return FFmpegErrorCode.UNKNOWN;
  const lower = output.toLowerCase();
  if (lower.includes('cancelled by user')) return FFmpegErrorCode.CANCELLED;
  if (lower.includes('out of memory')) return FFmpegErrorCode.OUT_OF_MEMORY;
  if (lower.includes('invalid argument') || lower.includes('missing input'))
    return FFmpegErrorCode.INVALID_ARGUMENT;
  if (lower.includes('i/o error') || lower.includes('cannot open'))
    return FFmpegErrorCode.IO_ERROR;
  return FFmpegErrorCode.UNKNOWN;
}

/**
 * Extract the output file path from an FFmpeg command string.
 * Looks for the path after the last `-y` flag.
 */
export function extractOutputPath(command: string): string | null {
  const yIdx = command.lastIndexOf('-y ');
  if (yIdx === -1) return null;
  let path = command.slice(yIdx + 3).trim();
  if (path.startsWith('"') && path.endsWith('"')) {
    path = path.slice(1, -1);
  }
  return path || null;
}

export async function execute(
  command: string,
  onProgress?: (progress: ProgressData) => void,
  options?: ExecuteOptions,
): Promise<ExecutionResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;

  const subscription = onProgress
    ? ExpoFfmpegModule.addListener('onProgress', onProgress)
    : undefined;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await (timeout > 0
      ? new Promise<ExecutionResult>((resolve, reject) => {
          timeoutId = setTimeout(() => {
            cancel();
            reject(new Error('FFmpeg execution timed out'));
          }, timeout);

          ExpoFfmpegModule.execute(command).then(resolve, reject);
        })
      : ExpoFfmpegModule.execute(command));

    return result;
  } catch (error) {
    // On failure or cancel, clean up partial output file
    const outputPath = extractOutputPath(command);
    if (outputPath) {
      deleteFileIfExists(outputPath);
    }
    throw error;
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
    subscription?.remove();
  }
}

export function cancel(): void {
  ExpoFfmpegModule.cancel();
}

export async function getMediaInfo(path: string): Promise<MediaInfo> {
  return ExpoFfmpegModule.getMediaInfo(path);
}

export async function extractThumbnail(
  videoPath: string,
  outputPath: string,
  timeSeconds: number = 1,
): Promise<ExecutionResult> {
  const command = buildExtractThumbnailCommand(videoPath, outputPath, timeSeconds);
  return execute(command);
}
