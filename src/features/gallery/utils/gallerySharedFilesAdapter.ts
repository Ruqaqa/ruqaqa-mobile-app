import type { ImagePickerAsset } from 'expo-image-picker';
import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';
import { MAX_IMAGES, MAX_VIDEO } from '../types';

/**
 * Result of converting shared files to upload form assets.
 */
export interface GallerySharedFilesResult {
  images: ImagePickerAsset[];
  video: ImagePickerAsset | null;
  /** Number of files that were dropped due to limits. */
  droppedCount: number;
}

const IMAGE_MIME_PREFIXES = ['image/'];
const VIDEO_MIME_PREFIXES = ['video/'];

function isImageMime(mimeType: string): boolean {
  return IMAGE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

function isVideoMime(mimeType: string): boolean {
  return VIDEO_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

/**
 * Convert shared files from the share intent system to the format expected
 * by the gallery upload form (ImagePickerAsset arrays).
 *
 * Separates images from videos, enforces MAX_IMAGES and MAX_VIDEO limits,
 * and maps SharedFile fields to ImagePickerAsset fields.
 *
 * @param sharedFiles  Files received from the share intent.
 * @returns            Images and video ready for the upload form, plus dropped count.
 */
export function convertSharedFilesToUploadAssets(
  sharedFiles: SharedFile[],
): GallerySharedFilesResult {
  const images: ImagePickerAsset[] = [];
  let video: ImagePickerAsset | null = null;
  let droppedCount = 0;

  for (const file of sharedFiles) {
    if (!file.uri || !file.mimeType) {
      droppedCount++;
      continue;
    }

    if (isVideoMime(file.mimeType)) {
      if (video === null) {
        video = {
          uri: file.uri,
          type: 'video',
          width: 0,
          height: 0,
          mimeType: file.mimeType,
          fileSize: file.fileSize ?? undefined,
          fileName: file.fileName ?? undefined,
        } as ImagePickerAsset;
      } else {
        // Only 1 video allowed
        droppedCount++;
      }
    } else if (isImageMime(file.mimeType)) {
      if (images.length < MAX_IMAGES) {
        images.push({
          uri: file.uri,
          type: 'image',
          width: 0,
          height: 0,
          mimeType: file.mimeType,
          fileSize: file.fileSize ?? undefined,
          fileName: file.fileName ?? undefined,
        } as ImagePickerAsset);
      } else {
        droppedCount++;
      }
    } else {
      // Unsupported MIME type — should have been filtered by share intent validation
      droppedCount++;
    }
  }

  return { images, video, droppedCount };
}
