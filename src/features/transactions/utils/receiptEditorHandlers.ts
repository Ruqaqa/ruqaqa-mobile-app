import { TransactionReceipt } from '../types';
import { ReceiptAttachment } from '../components/ReceiptPickerSection';
import { ReceiptEditorMode } from '../components/ReceiptEditorScreen';
import { ReceiptEditMode } from './receiptEditorPermissions';
import {
  uploadReceipt,
  addReceiptsToTransaction,
  updateTransactionReceipts,
} from '../services/receiptService';

/**
 * Map the permission-layer mode ('full-edit' | 'add-only') to the
 * ReceiptEditorScreen mode ('edit' | 'add').
 */
export function mapEditModeToEditorMode(
  mode: 'full-edit' | 'add-only',
): ReceiptEditorMode {
  return mode === 'full-edit' ? 'edit' : 'add';
}

/**
 * Creates the onUploadFiles callback for ReceiptEditorScreen.
 * Uploads each file sequentially and returns TransactionReceipt objects.
 */
export function createUploadHandler() {
  return async (
    _transactionId: string,
    files: ReceiptAttachment[],
  ): Promise<TransactionReceipt[]> => {
    const results: TransactionReceipt[] = [];

    for (const file of files) {
      const receiptId = await uploadReceipt(file);
      results.push({
        id: receiptId,
        filename: file.name,
        mimeType: file.mimeType,
      });
    }

    return results;
  };
}

/**
 * Creates the onRemoveReceipts callback for ReceiptEditorScreen.
 * Not needed because we handle removal in the save-complete handler.
 */
export function createRemoveHandler() {
  // No-op: full-edit mode removal is handled by updateTransactionReceipts
  // in the save-complete handler, which sends the final receipt ID list.
  return async (_transactionId: string, _receiptIds: string[]) => {
    // intentionally empty
  };
}

interface SaveCompleteOptions {
  transactionId: string;
  mode: ReceiptEditorMode;
  existingReceiptIds: string[];
  onRefresh: () => void;
}

/**
 * Creates the onSaveComplete callback for ReceiptEditorScreen.
 *
 * For add-only mode: calls addReceiptsToTransaction with new receipt IDs.
 * For full-edit mode: calls updateTransactionReceipts with the full list.
 *
 * Always calls onRefresh to update the transaction list, even on API error
 * (since the modal is already closing and uploads already succeeded).
 */
export function createSaveCompleteHandler(options: SaveCompleteOptions) {
  const { transactionId, mode, existingReceiptIds, onRefresh } = options;

  return async (updatedReceipts: TransactionReceipt[]) => {
    const updatedIds = updatedReceipts.map((r) => r.id);

    try {
      if (mode === 'add') {
        const newIds = updatedIds.filter(
          (id) => !existingReceiptIds.includes(id),
        );
        if (newIds.length > 0) {
          await addReceiptsToTransaction(transactionId, newIds);
        }
      } else {
        await updateTransactionReceipts(transactionId, updatedIds);
      }
    } catch {
      // Swallow errors — modal is closing, uploads already succeeded.
      // The refresh below will fetch the current server state.
    }

    onRefresh();
  };
}
