import { AppState, type NativeEventSubscription } from 'react-native';
import { File as FSFile, Paths } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { ImagePickerAsset } from 'expo-image-picker';

import {
  ItemState,
  PipelineItemStatus,
  PipelineStatus,
  PipelineResult,
  WatermarkDraft,
  DuplicateInfo,
  DuplicateDecision,
  CheckHashResult,
  MAX_FILE_SIZE_BYTES,
  MAX_CONCURRENT_UPLOADS,
  MAX_UPLOAD_RETRIES,
  IMAGE_WEIGHT,
  IMAGE_OPTIMIZE_WEIGHT,
  IMAGE_WATERMARK_WEIGHT,
  IMAGE_UPLOAD_WEIGHT,
  VIDEO_WEIGHT,
  VIDEO_OPTIMIZE_WEIGHT,
  VIDEO_WATERMARK_WEIGHT,
  VIDEO_UPLOAD_WEIGHT,
} from '../types';
import { computeFileHash } from './fileHashService';
import { optimizeImage } from './imageOptimizationService';
import {
  optimizeVideo,
  watermarkVideo,
  cancelVideoCompression,
} from './videoOptimizationService';
import { checkHash, addItemToAlbums, uploadItem } from './galleryService';
import { applyWatermarkToImage } from './watermarkApplicatorService';
import {
  showVideoProcessingProgress,
  showVideoProcessingResult,
  dismissVideoProcessingNotifications,
} from './videoProcessingNotificationService';
import { isValidObjectId } from '@/utils/sanitize';

// ---------------------------------------------------------------------------
// Keep-awake tag (unique per module to avoid conflicts)
// ---------------------------------------------------------------------------

const KEEP_AWAKE_TAG = 'gallery-upload-pipeline';

// ---------------------------------------------------------------------------
// Types for pipeline callbacks
// ---------------------------------------------------------------------------

/** Callback to resolve a duplicate: returns decision + whether to apply to all remaining. */
export type DuplicateDecisionCallback = (
  info: DuplicateInfo,
) => Promise<{ decision: DuplicateDecision; applyToAll: boolean }>;

export interface UploadPipelineConfig {
  images: ImagePickerAsset[];
  video: ImagePickerAsset | null;
  albumIds: string[];
  tagIds?: string[];
  projectId?: string;
  watermarkDrafts?: Record<string, WatermarkDraft> | null;
  /** Local file URI of the bundled watermark logo (e.g. from Asset.fromModule). */
  logoUri?: string;

  /** Called whenever pipeline status changes (progress, item states). */
  onStatusChanged: (status: PipelineStatus) => void;
  /** Called when a duplicate is found. Pipeline pauses until resolved. */
  onDuplicateFound?: DuplicateDecisionCallback;
}

// ---------------------------------------------------------------------------
// Internal item wrapper
// ---------------------------------------------------------------------------

interface PipelineItem {
  index: number;
  originalUri: string;
  fileToUploadUri: string;
  alreadyOptimized: boolean;
  noWatermarkNeeded: boolean;
  originalSourceHash?: string;
  watermarkDraft?: WatermarkDraft;
}

// ---------------------------------------------------------------------------
// Upload pipeline
// ---------------------------------------------------------------------------

/**
 * Orchestrates the upload pipeline: hash → dedup → optimize → size check →
 * (watermark placeholder) → upload.
 *
 * Background safety:
 * - `expo-keep-awake` prevents device sleep during the pipeline run.
 * - `AppState` listener reduces upload concurrency when backgrounded
 *   (from MAX_CONCURRENT_UPLOADS to 1) to respect OS resource limits.
 * - Video optimization supports cancellation via `cancelVideoCompression()`.
 *
 * Mirrors Flutter's `UploadPipeline.run()`.
 */
export class UploadPipeline {
  private config: UploadPipelineConfig;

  private items: PipelineItemStatus[] = [];
  private totalWeight = 0;
  private completedWeight = 0;

  private successCount = 0;
  private failedCount = 0;
  private skippedCount = 0;
  private oversizedCount = 0;
  private bytesSaved = 0;

  private tempFileUris: string[] = [];
  private applyToAllDecision: DuplicateDecision | null = null;

  /** Current effective concurrency limit — reduced when backgrounded. */
  private concurrencyLimit = MAX_CONCURRENT_UPLOADS;
  private appStateSubscription: NativeEventSubscription | null = null;

  constructor(config: UploadPipelineConfig) {
    this.config = config;
  }

  async run(): Promise<PipelineResult> {
    const { images, video } = this.config;
    const totalCount = images.length + (video ? 1 : 0);

    this.totalWeight = images.length * IMAGE_WEIGHT + (video ? VIDEO_WEIGHT : 0);
    this.completedWeight = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.skippedCount = 0;
    this.oversizedCount = 0;
    this.bytesSaved = 0;
    this.tempFileUris = [];
    this.applyToAllDecision = null;
    this.concurrencyLimit = MAX_CONCURRENT_UPLOADS;

    // Initialize item statuses
    this.items = [
      ...images.map((img) => ({
        filename: getFilename(img.uri),
        state: 'waiting' as ItemState,
      })),
      ...(video
        ? [{ filename: getFilename(video.uri), state: 'waiting' as ItemState }]
        : []),
    ];
    this.reportStatus();

    // Prevent device from sleeping during upload
    try { await activateKeepAwakeAsync(KEEP_AWAKE_TAG); } catch { /* ignore */ }

    // Listen for app state changes to adjust concurrency
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      this.concurrencyLimit = state === 'active'
        ? MAX_CONCURRENT_UPLOADS
        : 1;
    });

    try {
      await this.processImages();

      if (video) {
        await this.processVideo();
      }
    } finally {
      this.cleanupTempFiles();
      this.appStateSubscription?.remove();
      this.appStateSubscription = null;
      try { deactivateKeepAwake(KEEP_AWAKE_TAG); } catch { /* ignore */ }
    }

    return {
      successCount: this.successCount,
      failedCount: this.failedCount,
      skippedCount: this.skippedCount,
      oversizedCount: this.oversizedCount,
      totalCount,
      bytesSaved: this.bytesSaved,
    };
  }

  // -----------------------------------------------------------------------
  // Status reporting
  // -----------------------------------------------------------------------

  private setItemState(
    index: number,
    state: ItemState,
    extra?: { actualSizeBytes?: number; originalSizeBytes?: number; progressPercent?: number },
  ) {
    this.items[index] = {
      ...this.items[index],
      state,
      ...(extra?.actualSizeBytes !== undefined && { actualSizeBytes: extra.actualSizeBytes }),
      ...(extra?.originalSizeBytes !== undefined && { originalSizeBytes: extra.originalSizeBytes }),
      // Only include progressPercent when explicitly provided; clear it otherwise
      progressPercent: extra?.progressPercent,
    };
    this.reportStatus();
  }

  private reportStatus() {
    const progress =
      this.totalWeight > 0
        ? Math.min(1, Math.max(0, this.completedWeight / this.totalWeight))
        : 0;

    this.config.onStatusChanged({
      progress,
      completedCount: this.successCount + this.skippedCount,
      failedCount: this.failedCount,
      totalCount: this.items.length,
      items: [...this.items],
    });
  }

  // -----------------------------------------------------------------------
  // Dedup check
  // -----------------------------------------------------------------------

  private async dedupCheck(
    index: number,
    uri: string,
  ): Promise<{ skip: boolean; hash?: string }> {
    // Hash the file
    this.setItemState(index, 'hashing');
    let hash: string;
    try {
      hash = await computeFileHash(uri);
    } catch {
      // Hash failed — proceed without dedup
      return { skip: false };
    }

    // Check server for duplicates
    this.setItemState(index, 'checkingDuplicate');
    let checkResult: CheckHashResult | null;
    try {
      checkResult = await checkHash(hash);
    } catch {
      return { skip: false, hash };
    }

    if (!checkResult || !checkResult.exists) {
      return { skip: false, hash };
    }

    // Duplicate found — resolve decision
    const decision = await this.resolveDuplicateDecision(index, uri, checkResult);

    if (decision === 'addToAlbums') {
      const itemId = checkResult.item?.id;
      // Validate server-provided item ID before trusting it
      if (itemId && isValidObjectId(itemId)) {
        await addItemToAlbums(
          itemId,
          this.config.albumIds,
          this.config.tagIds,
          this.config.projectId,
        );
      }
      this.successCount++;
      this.completedWeight += IMAGE_WEIGHT;
      this.setItemState(index, 'done');
      return { skip: true, hash };
    }

    // Skip
    this.skippedCount++;
    this.completedWeight += IMAGE_WEIGHT;
    this.setItemState(index, 'skipped');
    return { skip: true, hash };
  }

  private async resolveDuplicateDecision(
    _index: number,
    uri: string,
    checkResult: CheckHashResult,
  ): Promise<DuplicateDecision> {
    if (this.applyToAllDecision) return this.applyToAllDecision;

    if (!this.config.onDuplicateFound) return 'skip';

    const info: DuplicateInfo = {
      filename: getFilename(uri),
      checkResult,
    };
    const result = await this.config.onDuplicateFound(info);
    if (result.applyToAll) {
      this.applyToAllDecision = result.decision;
    }
    return result.decision;
  }

  // -----------------------------------------------------------------------
  // Image processing
  // -----------------------------------------------------------------------

  private async processImages() {
    const { images } = this.config;
    const activeUploads: Promise<void>[] = [];

    for (let i = 0; i < images.length; i++) {
      // Copy the ImagePicker cache file to a pipeline-owned location so it
      // survives Android cache eviction during long batch uploads.  The
      // original URI lives in cache/ImagePicker/ which the OS can purge at
      // any time under memory pressure.
      const stableUri = copyToStablePath(images[i].uri, i);
      if (stableUri !== images[i].uri) {
        this.tempFileUris.push(stableUri);
      }

      const dedupResult = await this.dedupCheck(i, stableUri);
      if (dedupResult.skip) continue;

      // Optimize
      this.setItemState(i, 'optimizing');
      let item: PipelineItem;
      try {
        const result = await optimizeImage(stableUri);
        item = {
          index: i,
          originalUri: stableUri,
          fileToUploadUri: result.uri,
          alreadyOptimized: result.wasOptimized,
          noWatermarkNeeded: false,
          originalSourceHash: dedupResult.hash,
        };
        if (result.wasOptimized && result.uri !== stableUri) {
          this.tempFileUris.push(result.uri);
          this.bytesSaved += result.originalSize - result.optimizedSize;
        }
        this.completedWeight += IMAGE_OPTIMIZE_WEIGHT;
      } catch (err) {
        console.error('[pipeline] Optimization failed for image', i, err);
        this.failedCount++;
        this.completedWeight += IMAGE_WEIGHT;
        this.setItemState(i, 'failed');
        continue;
      }

      // Size check
      this.setItemState(i, 'checkingSize');
      const optimizedFile = new FSFile(item.fileToUploadUri);
      const optimizedSize = optimizedFile.size;
      const originalFile = new FSFile(item.originalUri);
      const originalSize = originalFile.size;

      if (optimizedSize > MAX_FILE_SIZE_BYTES) {
        this.oversizedCount++;
        this.completedWeight += IMAGE_WATERMARK_WEIGHT + IMAGE_UPLOAD_WEIGHT;
        this.setItemState(i, 'sizeExceeded', {
          actualSizeBytes: optimizedSize,
          originalSizeBytes: originalSize,
        });
        this.cleanupItemTemp(item);
        continue;
      }

      // Watermark — apply logo overlay if draft is available and watermark is needed
      const wmDraft = this.getWatermarkDraft(i);
      if (wmDraft) {
        item.watermarkDraft = wmDraft;
        item.noWatermarkNeeded = wmDraft.noWatermarkNeeded;

        if (!wmDraft.noWatermarkNeeded && this.config.logoUri) {
          this.setItemState(i, 'watermarking');
          try {
            const wmResult = await applyWatermarkToImage(
              item.fileToUploadUri,
              wmDraft,
              this.config.logoUri,
            );
            if (wmResult.applied && wmResult.uri !== item.fileToUploadUri) {
              this.tempFileUris.push(wmResult.uri);
              item.fileToUploadUri = wmResult.uri;
            }
          } catch (err) {
            // Watermark failure is non-fatal — proceed with un-watermarked image
            console.error('[pipeline] Watermark failed for image', i, err);
          }
        }
      }
      this.completedWeight += IMAGE_WATERMARK_WEIGHT;

      // Upload with concurrency control (respects backgrounded limit)
      this.setItemState(i, 'uploading');

      const uploadPromise = this.uploadWithRetry(item).then(() => {
        const idx = activeUploads.indexOf(uploadPromise);
        if (idx !== -1) activeUploads.splice(idx, 1);
      });
      activeUploads.push(uploadPromise);

      if (activeUploads.length >= this.concurrencyLimit) {
        await Promise.race(activeUploads);
      }
    }

    await Promise.all(activeUploads);
  }

  // -----------------------------------------------------------------------
  // Upload with retry
  // -----------------------------------------------------------------------

  private async uploadWithRetry(item: PipelineItem): Promise<void> {
    for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
      const result = await uploadItem({
        fileUri: item.fileToUploadUri,
        alreadyOptimized: item.alreadyOptimized,
        noWatermarkNeeded: item.noWatermarkNeeded,
        albumIds: this.config.albumIds,
        tagIds: this.config.tagIds,
        projectId: this.config.projectId,
        originalSourceHash: item.originalSourceHash,
        watermarkDraft: item.watermarkDraft,
      });

      if (result.outcome === 'success') {
        this.successCount++;
        this.completedWeight += IMAGE_UPLOAD_WEIGHT;
        this.setItemState(item.index, 'done');
        this.cleanupItemTemp(item);
        return;
      }

      if (result.outcome === 'duplicate') {
        this.failedCount++;
        this.completedWeight += IMAGE_UPLOAD_WEIGHT;
        this.setItemState(item.index, 'failed');
        this.cleanupItemTemp(item);
        return;
      }

      if (result.outcome === 'fileTooLarge') {
        this.oversizedCount++;
        this.completedWeight += IMAGE_UPLOAD_WEIGHT;
        this.setItemState(item.index, 'sizeExceeded');
        this.cleanupItemTemp(item);
        return;
      }

      // Retry with exponential backoff
      if (attempt < MAX_UPLOAD_RETRIES) {
        const backoff = 500 * Math.pow(2, attempt);
        await delay(backoff);
      }
    }

    // All retries exhausted
    this.failedCount++;
    this.completedWeight += IMAGE_UPLOAD_WEIGHT;
    this.setItemState(item.index, 'failed');
    this.cleanupItemTemp(item);
  }

  // -----------------------------------------------------------------------
  // Video processing — dual-variant: compress + watermark as separate passes
  // -----------------------------------------------------------------------

  private async processVideo() {
    const video = this.config.video!;
    const videoIndex = this.items.length - 1;

    // Copy to stable storage — same rationale as images (cache eviction).
    const stableVideoUri = copyToStablePath(video.uri, videoIndex);
    if (stableVideoUri !== video.uri) {
      this.tempFileUris.push(stableVideoUri);
    }

    const dedupResult = await this.dedupCheck(videoIndex, stableVideoUri);
    if (dedupResult.skip) return;

    // Resolve video watermark draft (video is always the last item)
    const videoWmDraft = this.getVideoWatermarkDraft();
    const noWatermarkNeeded = videoWmDraft?.noWatermarkNeeded ?? true;
    console.log('[pipeline] Video watermark draft:', JSON.stringify(videoWmDraft));
    console.log('[pipeline] noWatermarkNeeded:', noWatermarkNeeded, 'logoUri:', !!this.config.logoUri);

    // --- Step 1: Compress-only (no watermark) ---
    this.setItemState(videoIndex, 'optimizing');
    let videoFileUri = stableVideoUri;
    let videoWasOptimized = false;
    let videoProcessingSucceeded = false;
    try {
      const optResult = await optimizeVideo(
        stableVideoUri,
        (progress) => {
          this.setItemState(videoIndex, 'optimizing', { progressPercent: progress });
          // Update foreground notification with progress
          showVideoProcessingProgress(progress * 100).catch(() => { /* ignore */ });
        },
      );

      videoFileUri = optResult.uri;
      videoWasOptimized = optResult.wasOptimized;
      videoProcessingSucceeded = true;
      if (optResult.wasOptimized && optResult.uri !== stableVideoUri) {
        this.tempFileUris.push(optResult.uri);
        this.bytesSaved += optResult.originalSize - optResult.optimizedSize;
      }
    } catch {
      // Optimization failed — proceed with original file
    }
    // Show result notification (awaited so it lands before any late progress updates)
    await showVideoProcessingResult(videoProcessingSucceeded).catch(() => { /* ignore */ });
    this.completedWeight += VIDEO_OPTIMIZE_WEIGHT;

    // --- Step 2: Size check on compressed file ---
    this.setItemState(videoIndex, 'checkingSize');
    const videoFile = new FSFile(videoFileUri);
    const videoSize = videoFile.size;
    const originalVideoFile = new FSFile(stableVideoUri);
    const originalVideoSize = originalVideoFile.size;
    if (videoSize > MAX_FILE_SIZE_BYTES) {
      this.oversizedCount++;
      this.completedWeight += VIDEO_WATERMARK_WEIGHT + VIDEO_UPLOAD_WEIGHT;
      this.setItemState(videoIndex, 'sizeExceeded', {
        actualSizeBytes: videoSize,
        originalSizeBytes: originalVideoSize,
      });
      return;
    }

    // --- Step 3: Watermark + compress in single pass from original source ---
    // Uses the original source (stableVideoUri), NOT the already-compressed file,
    // to avoid double-encoding which degrades quality and inflates file size.
    let watermarkedFileUri: string | undefined;
    if (!noWatermarkNeeded && videoWmDraft && this.config.logoUri) {
      this.setItemState(videoIndex, 'watermarking');
      try {
        const wmResult = await watermarkVideo(
          stableVideoUri,
          videoWmDraft,
          this.config.logoUri,
          (progress) => {
            this.setItemState(videoIndex, 'watermarking', { progressPercent: progress });
          },
        );
        if (wmResult.wasOptimized && wmResult.uri !== stableVideoUri) {
          watermarkedFileUri = wmResult.uri;
          this.tempFileUris.push(wmResult.uri);
        }
      } catch (err) {
        // Watermark failure is non-fatal — proceed without watermarked variant
        console.error('[pipeline] Video watermark failed:', err);
      }

      // Non-fatal size check on watermarked file
      if (watermarkedFileUri) {
        const wmFile = new FSFile(watermarkedFileUri);
        if (wmFile.size > MAX_FILE_SIZE_BYTES) {
          console.warn('[pipeline] Watermarked video exceeds max size, proceeding without it');
          watermarkedFileUri = undefined;
        }
      }
    }
    this.completedWeight += VIDEO_WATERMARK_WEIGHT;

    // --- Step 4: Upload (compressed + optional watermarked variant) ---
    console.log('[pipeline] Upload: fileUri=', videoFileUri, 'watermarkedFileUri=', watermarkedFileUri);
    this.setItemState(videoIndex, 'uploading');
    for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
      const result = await uploadItem({
        fileUri: videoFileUri,
        watermarkedFileUri,
        alreadyOptimized: videoWasOptimized,
        noWatermarkNeeded,
        albumIds: this.config.albumIds,
        tagIds: this.config.tagIds,
        projectId: this.config.projectId,
        originalSourceHash: dedupResult.hash,
        watermarkDraft: noWatermarkNeeded ? undefined : videoWmDraft ?? undefined,
      });

      if (result.outcome === 'success') {
        this.successCount++;
        this.completedWeight += VIDEO_UPLOAD_WEIGHT;
        this.setItemState(videoIndex, 'done');
        return;
      }

      if (result.outcome === 'duplicate') {
        this.failedCount++;
        this.completedWeight += VIDEO_UPLOAD_WEIGHT;
        this.setItemState(videoIndex, 'failed');
        return;
      }

      if (result.outcome === 'fileTooLarge') {
        this.oversizedCount++;
        this.completedWeight += VIDEO_UPLOAD_WEIGHT;
        this.setItemState(videoIndex, 'sizeExceeded');
        return;
      }

      if (attempt < MAX_UPLOAD_RETRIES) {
        const backoff = 500 * Math.pow(2, attempt);
        await delay(backoff);
      }
    }

    this.failedCount++;
    this.completedWeight += VIDEO_UPLOAD_WEIGHT;
    this.setItemState(videoIndex, 'failed');
  }

  // -----------------------------------------------------------------------
  // Watermark drafts
  // -----------------------------------------------------------------------

  private getWatermarkDraft(imageIndex: number): WatermarkDraft | undefined {
    const drafts = this.config.watermarkDrafts;
    if (!drafts) return undefined;
    const asset = this.config.images[imageIndex];
    // Watermark drafts are keyed by asset URI (or asset ID if available)
    const key = asset.assetId ?? asset.uri;
    return drafts[key];
  }

  private getVideoWatermarkDraft(): WatermarkDraft | undefined {
    const drafts = this.config.watermarkDrafts;
    if (!drafts || !this.config.video) return undefined;
    const video = this.config.video;
    const key = video.assetId ?? video.uri;
    return drafts[key];
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  private cleanupItemTemp(item: PipelineItem) {
    if (item.fileToUploadUri !== item.originalUri) {
      try {
        const f = new FSFile(item.fileToUploadUri);
        if (f.exists) f.delete();
      } catch { /* ignore */ }
      const idx = this.tempFileUris.indexOf(item.fileToUploadUri);
      if (idx !== -1) this.tempFileUris.splice(idx, 1);
    }
  }

  private cleanupTempFiles() {
    for (const uri of this.tempFileUris) {
      try {
        const f = new FSFile(uri);
        if (f.exists) f.delete();
      } catch { /* ignore */ }
    }
    this.tempFileUris = [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFilename(uri: string): string {
  const segments = uri.split('/');
  return segments[segments.length - 1] || 'unknown';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Copy an ImagePicker cache file to a pipeline-owned location so it survives
 * Android cache eviction. Returns the new stable URI. The caller is responsible
 * for deleting the copy when done (tracked via `tempFileUris`).
 */
function copyToStablePath(uri: string, index: number): string {
  const src = new FSFile(uri);
  if (!src.exists) return uri; // nothing to copy — will be caught later
  const ext = uri.lastIndexOf('.') !== -1
    ? uri.substring(uri.lastIndexOf('.')).split(/[?#]/)[0].toLowerCase()
    : '';
  const dest = new FSFile(Paths.cache, `pipeline_${index}_${Date.now()}${ext}`);
  src.copy(dest);
  return dest.uri;
}
