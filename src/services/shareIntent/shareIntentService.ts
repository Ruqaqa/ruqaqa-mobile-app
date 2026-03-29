import type { SharedFile } from './shareIntentTypes';
import { shareIntentStore } from './shareIntentStore';
import {
  validateMimeType,
  validateFileSize,
  resolveFileType,
  sanitizeFileName,
} from './shareIntentValidation';

/**
 * Process incoming shared files from expo-share-intent.
 * Called from the ShareIntentBridge component when the library detects shared content.
 */
export function handleIncomingFiles(
  files: Array<{ path: string; mimeType: string; fileName: string; size: number | null }>,
): void {
  if (!files || files.length === 0) return;

  const validated: SharedFile[] = [];

  for (const raw of files) {
    const mimeType = raw.mimeType ?? '';
    const uri = raw.path ?? '';

    if (!uri) continue;

    if (!validateMimeType(mimeType)) {
      if (__DEV__) console.warn('[ShareIntent] Rejected MIME:', mimeType);
      continue;
    }

    if (!validateFileSize(raw.size ?? undefined)) {
      if (__DEV__) console.warn('[ShareIntent] File too large:', raw.size);
      continue;
    }

    validated.push({
      uri,
      mimeType,
      fileType: resolveFileType(mimeType),
      fileName: raw.fileName ? sanitizeFileName(raw.fileName) : null,
      fileSize: raw.size,
    });
  }

  if (validated.length > 0) {
    shareIntentStore.setFiles(validated);
  }
}
