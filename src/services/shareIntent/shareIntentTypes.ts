import type { UserPermissions } from '@/types/permissions';

/** A file received via share intent from an external app. */
export interface SharedFile {
  uri: string;
  mimeType: string;
  fileType: 'image' | 'video' | 'document';
  fileName: string | null;
  fileSize: number | null;
}

/** Identifiers for features that can receive shared files. */
export type ShareFlowTargetId = 'transaction' | 'reconciliation' | 'gallery';

/** Configuration for a flow target shown in the selector. */
export interface ShareFlowTarget {
  id: ShareFlowTargetId;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  maxFiles: number;
  allowedMimeTypes: readonly string[] | null;
  isAvailable: (permissions: UserPermissions) => boolean;
}

/** State machine for the share intent flow. */
export type ShareIntentState =
  | { status: 'idle' }
  | { status: 'files_received'; files: SharedFile[] }
  | { status: 'flow_selected'; files: SharedFile[]; targetId: ShareFlowTargetId }
  | { status: 'consumed' };
