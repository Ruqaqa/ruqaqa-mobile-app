import { File as FSFile } from 'expo-file-system';
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
  VIDEO_UPLOAD_WEIGHT,
} from '../types';
import { computeFileHash } from './fileHashService';
import { optimizeImage } from './imageOptimizationService';
import { checkHash, addItemToAlbums, uploadItem } from './galleryService';
import { isValidObjectId } from '@/utils/sanitize';

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

    try {
      await this.processImages();

      if (video) {
        await this.processVideo();
      }
    } finally {
      this.cleanupTempFiles();
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
    extra?: { actualSizeBytes?: number; originalSizeBytes?: number },
  ) {
    this.items[index] = {
      ...this.items[index],
      state,
      ...(extra?.actualSizeBytes !== undefined && { actualSizeBytes: extra.actualSizeBytes }),
      ...(extra?.originalSizeBytes !== undefined && { originalSizeBytes: extra.originalSizeBytes }),
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
      const dedupResult = await this.dedupCheck(i, images[i].uri);
      if (dedupResult.skip) continue;

      // Optimize
      this.setItemState(i, 'optimizing');
      let item: PipelineItem;
      try {
        const result = await optimizeImage(images[i].uri);
        item = {
          index: i,
          originalUri: images[i].uri,
          fileToUploadUri: result.uri,
          alreadyOptimized: result.wasOptimized,
          noWatermarkNeeded: false,
          originalSourceHash: dedupResult.hash,
        };
        if (result.wasOptimized && result.uri !== images[i].uri) {
          this.tempFileUris.push(result.uri);
          this.bytesSaved += result.originalSize - result.optimizedSize;
        }
        this.completedWeight += IMAGE_OPTIMIZE_WEIGHT;
      } catch {
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

      // Watermark placeholder — apply draft if available
      const wmDraft = this.getWatermarkDraft(i);
      if (wmDraft) {
        item.watermarkDraft = wmDraft;
        item.noWatermarkNeeded = wmDraft.noWatermarkNeeded;
      }
      this.completedWeight += IMAGE_WATERMARK_WEIGHT;

      // Upload with concurrency control
      this.setItemState(i, 'uploading');

      const uploadPromise = this.uploadWithRetry(item).then(() => {
        const idx = activeUploads.indexOf(uploadPromise);
        if (idx !== -1) activeUploads.splice(idx, 1);
      });
      activeUploads.push(uploadPromise);

      if (activeUploads.length >= MAX_CONCURRENT_UPLOADS) {
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
  // Video processing (placeholder for Phase 6C)
  // -----------------------------------------------------------------------

  private async processVideo() {
    const video = this.config.video!;
    const videoIndex = this.items.length - 1;

    const dedupResult = await this.dedupCheck(videoIndex, video.uri);
    if (dedupResult.skip) return;

    // Video optimization would go here in Phase 6C.
    // For now, skip optimize and go straight to size check + upload.
    this.setItemState(videoIndex, 'optimizing');
    this.completedWeight += VIDEO_OPTIMIZE_WEIGHT;

    // Size check
    this.setItemState(videoIndex, 'checkingSize');
    const videoFile = new FSFile(video.uri);
    const videoSize = videoFile.size;
    if (videoSize > MAX_FILE_SIZE_BYTES) {
      this.oversizedCount++;
      this.completedWeight += VIDEO_UPLOAD_WEIGHT;
      this.setItemState(videoIndex, 'sizeExceeded', {
        actualSizeBytes: videoSize,
        originalSizeBytes: videoSize,
      });
      return;
    }

    // Upload
    this.setItemState(videoIndex, 'uploading');
    for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
      const result = await uploadItem({
        fileUri: video.uri,
        alreadyOptimized: false,
        noWatermarkNeeded: false,
        albumIds: this.config.albumIds,
        tagIds: this.config.tagIds,
        projectId: this.config.projectId,
        originalSourceHash: dedupResult.hash,
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
