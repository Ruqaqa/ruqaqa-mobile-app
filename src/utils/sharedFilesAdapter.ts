import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';
import type { ReceiptAttachment } from '@/features/transactions/components/ReceiptPickerSection';

let counter = 0;

interface ConversionResult {
  attachments: ReceiptAttachment[];
  overflow: number;
}

export function convertSharedFilesToAttachments(
  sharedFiles: SharedFile[],
  existingCount: number,
  maxAttachments: number,
): ConversionResult {
  const available = Math.max(0, maxAttachments - existingCount);
  const toConvert = sharedFiles.slice(0, available);
  const overflow = sharedFiles.length - toConvert.length;

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
