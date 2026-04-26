import { File, Directory, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import { config } from '@/services/config';
import { tokenStorage } from '@/services/tokenStorage';
import {
  DownloadFormat,
  DownloadJob,
  DownloadSnapshot,
  EMPTY_DOWNLOAD_SNAPSHOT,
  MediaItem,
} from '../types';
import { DownloadQueue, generateJobId } from './downloadQueue';
import { downloadNotificationObserver, dismissDownloadNotifications } from './downloadNotificationService';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Module-level cache for media library permission, checked once per batch in downloadItems(). */
let mediaLibraryGranted = false;

/**
 * Sanitize a filename by replacing forbidden characters.
 */
function sanitizeFilename(filename: string): string {
  if (!filename) {
    return `download_${Date.now()}`;
  }
  let cleaned = filename.replace(/[<>:"/\\|?*]/g, '_');
  if (cleaned.length > 200) {
    const dotIndex = cleaned.lastIndexOf('.');
    if (dotIndex > 0) {
      const ext = cleaned.substring(dotIndex);
      cleaned = cleaned.substring(0, 200 - ext.length) + ext;
    } else {
      cleaned = cleaned.substring(0, 200);
    }
  }
  return cleaned;
}

/**
 * Resolve the display filename for a media item.
 */
function resolveFilename(item: MediaItem): string {
  if (item.filename) {
    return sanitizeFilename(item.filename);
  }
  const ext = item.mediaType === 'video' ? '.mp4' : '.jpg';
  return `${item.id}${ext}`;
}

/**
 * Build the download URL for a gallery item, optionally requesting watermarked variant.
 */
function resolveSourceUrl(itemId: string, format?: DownloadFormat): string {
  const base = `${config.apiBaseUrl}/api/gallery/media/${itemId}`;
  if (format === 'watermarked') {
    return `${base}?variant=watermarked`;
  }
  return base;
}

/**
 * Execute a single download job: download to cache, then save to media library.
 * Returns the final URI of the saved file.
 */
async function executeDownload(
  job: DownloadJob,
  onProgress: (jobId: string, progress: number) => void,
  signal: AbortSignal,
): Promise<string> {
  // Get auth token
  const token = await tokenStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Use the new expo-file-system API: download to cache directory
  const cacheDir = new Directory(Paths.cache, 'gallery-downloads');
  if (!cacheDir.exists) {
    cacheDir.create();
  }

  // Create a unique filename to avoid collisions
  const uniqueName = `${Date.now()}_${job.displayFilename}`;
  const destFile = new File(cacheDir, uniqueName);

  onProgress(job.id, 0.05);

  // Download file (pass signal so abort cancels the HTTP request).
  // `signal` is supported at runtime but missing from the typed `DownloadOptions`.
  const downloadedFile = await File.downloadFileAsync(
    job.sourceUrl,
    destFile,
    { headers, idempotent: true, signal } as any,
  );

  onProgress(job.id, 0.85);

  // Check if canceled before saving to media library
  if (signal.aborted) {
    return downloadedFile.uri;
  }

  // Save to media library (makes it visible in Photos/Gallery app)
  // Permission is checked once upfront in downloadItems(), read cached result here.
  if (!mediaLibraryGranted) {
    // If permission denied, the file is still in cache — return cache URI
    onProgress(job.id, 1.0);
    return downloadedFile.uri;
  }

  try {
    const asset = await MediaLibrary.createAssetAsync(downloadedFile.uri);

    onProgress(job.id, 1.0);

    // Clean up cache file
    try {
      downloadedFile.delete();
    } catch {
      // Cleanup is best-effort
    }

    return asset.uri;
  } catch {
    // If MediaLibrary save fails, return cache URI as fallback
    onProgress(job.id, 1.0);
    return downloadedFile.uri;
  }
}

// --- Singleton download service ---

let queueInstance: DownloadQueue | null = null;

function getQueue(): DownloadQueue {
  if (!queueInstance) {
    queueInstance = new DownloadQueue(executeDownload);
    // Attach system notification observer (fire-and-forget)
    queueInstance.subscribe(downloadNotificationObserver);
  }
  return queueInstance;
}

/**
 * Download media items to the device.
 * Creates download jobs and enqueues them for processing.
 */
export async function downloadItems(
  items: MediaItem[],
  format?: DownloadFormat,
): Promise<void> {
  const queue = getQueue();
  const seen = new Set<string>();
  const jobs: DownloadJob[] = [];

  for (const item of items) {
    if (!item.id || !OBJECT_ID_RE.test(item.id)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    const filename = resolveFilename(item);
    const sourceUrl = resolveSourceUrl(item.id, format);

    jobs.push({
      id: generateJobId(),
      sourceUrl,
      destinationUri: '',
      displayFilename: filename,
      status: 'queued',
      progress: 0,
    });
  }

  if (jobs.length > 0) {
    // Check media library permission once for the entire batch
    const { status } = await MediaLibrary.requestPermissionsAsync();
    mediaLibraryGranted = status === 'granted';

    // Clear stale completed/failed jobs so the counter resets for the new batch
    queue.clearCompleted();
    await queue.enqueue(jobs);
  }
}

/**
 * Subscribe to download snapshot changes.
 * Returns an unsubscribe function.
 */
export function subscribeToDownloads(
  listener: (snapshot: DownloadSnapshot) => void,
): () => void {
  return getQueue().subscribe(listener);
}

/**
 * Get the current download snapshot.
 */
export function getDownloadSnapshot(): DownloadSnapshot {
  return queueInstance?.getSnapshot() ?? EMPTY_DOWNLOAD_SNAPSHOT;
}

/**
 * Cancel a specific download.
 */
export function cancelDownload(jobId: string): void {
  getQueue().cancelJob(jobId);
}

/**
 * Cancel all pending/running downloads.
 */
export function cancelAllDownloads(): void {
  getQueue().cancelAll();
}

/**
 * Clear completed/failed/canceled downloads from the list.
 */
export function clearCompletedDownloads(): void {
  getQueue().clearCompleted();
  dismissDownloadNotifications();
}
