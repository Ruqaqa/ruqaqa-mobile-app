import type { ShareFlowTarget } from './shareIntentTypes';
import type { UserPermissions } from '@/types/permissions';
import { ALLOWED_MIME_TYPES } from '@/features/transactions/components/ReceiptPickerSection';

export const SHARE_FLOW_TARGETS: ShareFlowTarget[] = [
  {
    id: 'transaction',
    labelKey: 'shareFlowTransaction',
    descriptionKey: 'shareFlowTransactionDesc',
    icon: 'Receipt',
    maxFiles: 4,
    allowedMimeTypes: ALLOWED_MIME_TYPES as unknown as string[],
    isAvailable: (p: UserPermissions) => p.canCreateTransactions,
  },
  {
    id: 'reconciliation',
    labelKey: 'shareFlowReconciliation',
    descriptionKey: 'shareFlowReconciliationDesc',
    icon: 'ArrowLeftRight',
    maxFiles: 4,
    allowedMimeTypes: ALLOWED_MIME_TYPES as unknown as string[],
    isAvailable: (p: UserPermissions) => p.canCreateReconciliation,
  },
  {
    id: 'gallery',
    labelKey: 'shareFlowGallery',
    descriptionKey: 'shareFlowGalleryDesc',
    icon: 'ImagePlus',
    maxFiles: 21, // MAX_IMAGES (20) + MAX_VIDEO (1)
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-matroska',
    ],
    isAvailable: (p: UserPermissions) => p.canCreateGallery,
  },
];
