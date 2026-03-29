import type { SharedFile } from './shareIntentTypes';

export const ALLOWED_SHARE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_SHARE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_SHARE_FILE_COUNT = 20;

export function validateMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  return (ALLOWED_SHARE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateFileSize(fileSize: number | undefined): boolean {
  if (fileSize === undefined) return true;
  return fileSize <= MAX_SHARE_FILE_SIZE_BYTES;
}

export function resolveFileType(mimeType: string): 'image' | 'document' {
  return mimeType.startsWith('image/') ? 'image' : 'document';
}

export function sanitizeFileName(name: string): string {
  if (!name) return 'shared_file';
  // Extract basename (last path component)
  const basename = name.replace(/\\/g, '/').split('/').pop() || 'shared_file';
  // Remove null bytes and angle brackets / other risky chars
  return basename.replace(/[\0<>]/g, '') || 'shared_file';
}

interface RawSharedFileInput {
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
}

interface RejectedFile {
  fileName: string;
  reason: 'invalidFileType' | 'fileTooLarge' | 'tooManyFiles';
}

interface ValidationResult {
  valid: SharedFile[];
  rejected: RejectedFile[];
}

export function validateSharedFiles(files: RawSharedFileInput[]): ValidationResult {
  const valid: SharedFile[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    if (valid.length >= MAX_SHARE_FILE_COUNT) {
      rejected.push({ fileName: file.fileName, reason: 'tooManyFiles' });
      continue;
    }

    if (!validateMimeType(file.mimeType)) {
      rejected.push({ fileName: file.fileName, reason: 'invalidFileType' });
      continue;
    }

    if (!validateFileSize(file.fileSize)) {
      rejected.push({ fileName: file.fileName, reason: 'fileTooLarge' });
      continue;
    }

    valid.push({
      uri: file.uri,
      mimeType: file.mimeType,
      fileType: resolveFileType(file.mimeType),
      fileName: sanitizeFileName(file.fileName),
      fileSize: file.fileSize ?? null,
    });
  }

  return { valid, rejected };
}
