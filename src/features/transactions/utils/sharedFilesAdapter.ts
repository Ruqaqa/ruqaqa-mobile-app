import { convertSharedFilesToAttachments as convert } from '@/utils/sharedFilesAdapter';
import { MAX_ATTACHMENTS } from '../components/ReceiptPickerSection';
import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';

export function convertSharedFilesToAttachments(
  sharedFiles: SharedFile[],
  existingCount: number,
) {
  return convert(sharedFiles, existingCount, MAX_ATTACHMENTS);
}
