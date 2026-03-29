export { shareIntentStore } from './shareIntentStore';
export { handleIncomingFiles } from './shareIntentService';
export { SHARE_FLOW_TARGETS } from './flowTargets';
export {
  validateMimeType,
  validateFileSize,
  validateSharedFiles,
  sanitizeFileName,
  resolveFileType,
  ALLOWED_SHARE_MIME_TYPES,
  MAX_SHARE_FILE_SIZE_BYTES,
  MAX_SHARE_FILE_COUNT,
} from './shareIntentValidation';
export type {
  SharedFile,
  ShareFlowTargetId,
  ShareFlowTarget,
  ShareIntentState,
} from './shareIntentTypes';
