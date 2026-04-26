import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';
import type { ReceiptAttachment } from '@/features/transactions/components/ReceiptPickerSection';

let counter = 0;

/** Max file size for receipt attachments (matches ReceiptPickerSection limit). */
const RECEIPT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface ConversionResult {
  attachments: ReceiptAttachment[];
  overflow: number;
}

export function convertSharedFilesToAttachments(
  sharedFiles: SharedFile[],
  existingCount: number,
  maxAttachments: number,
): ConversionResult {
  // Filter out video files and oversized files — only images/documents within 10 MB are valid.
  // Type predicate narrows fileType from `'image' | 'video' | 'document'` to `'image' | 'document'`.
  const eligible = sharedFiles.filter(
    (f): f is SharedFile & { fileType: 'image' | 'document' } =>
      f.fileType !== 'video' &&
      (f.fileSize === null || f.fileSize <= RECEIPT_MAX_FILE_SIZE_BYTES),
  );
  const available = Math.max(0, maxAttachments - existingCount);
  const toConvert = eligible.slice(0, available);
  const overflow = eligible.length - toConvert.length;

  const attachments: ReceiptAttachment[] = toConvert.map((file) => ({
    id: `shared_${++counter}`,
    uri: file.uri,
    type: file.fileType,
    name: file.fileName ?? `shared_${Date.now()}.${file.mimeType.split('/')[1] ?? 'jpg'}`,
    mimeType: file.mimeType,
    fileSize: file.fileSize ?? undefined,
  }));

  return { attachments, overflow };
}
