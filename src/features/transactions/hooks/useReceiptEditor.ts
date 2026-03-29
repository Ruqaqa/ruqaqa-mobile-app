import { useState, useCallback, useMemo } from 'react';
import { TransactionReceipt } from '../types';
import { ReceiptAttachment } from '../components/ReceiptPickerSection';
import {
  uploadReceipt,
  addReceiptsToTransaction,
  updateTransactionReceipts,
} from '../services/receiptService';

export interface UploadStatus {
  state: 'pending' | 'uploading' | 'done' | 'failed';
  percent: number;
  receiptId?: string;
  errorKey?: string;
}

export interface ReceiptEditorState {
  existingReceipts: TransactionReceipt[];
  keptReceiptIds: Set<string>;
  newAttachments: ReceiptAttachment[];
  uploadProgress: Map<string, UploadStatus>;
  isSaving: boolean;
  error: string | null;
}

interface UseReceiptEditorOptions {
  transactionId: string;
  existingReceipts: TransactionReceipt[];
  mode: 'add-only' | 'full-edit';
  onSuccess: () => void;
}

export function useReceiptEditor(options: UseReceiptEditorOptions) {
  const { transactionId, existingReceipts, mode, onSuccess } = options;

  const [keptReceiptIds, setKeptReceiptIds] = useState<Set<string>>(
    () => new Set(existingReceipts.map((r) => r.id)),
  );
  const [newAttachments, setNewAttachments] = useState<ReceiptAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<
    Map<string, UploadStatus>
  >(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAttachment = useCallback((att: ReceiptAttachment) => {
    setNewAttachments((prev) => [...prev, att]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setNewAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleExistingReceipt = useCallback(
    (receiptId: string) => {
      if (mode === 'add-only') return; // no-op in add-only mode

      setKeptReceiptIds((prev) => {
        const next = new Set(prev);
        if (next.has(receiptId)) {
          next.delete(receiptId);
        } else {
          next.add(receiptId);
        }
        return next;
      });
    },
    [mode],
  );

  const canSave = useMemo(() => {
    if (newAttachments.length > 0) return true;
    if (mode === 'full-edit') {
      // Check if any existing receipt was removed
      const originalCount = existingReceipts.length;
      if (keptReceiptIds.size !== originalCount) return true;
    }
    return false;
  }, [newAttachments.length, mode, existingReceipts.length, keptReceiptIds.size]);

  const save = useCallback(async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError(null);

    try {
      // Upload new files sequentially, skipping already-done ones
      const uploadedIds: string[] = [];

      for (const att of newAttachments) {
        const existing = uploadProgress.get(att.id);
        if (existing?.state === 'done' && existing.receiptId) {
          uploadedIds.push(existing.receiptId);
          continue;
        }

        setUploadProgress((prev) => {
          const next = new Map(prev);
          next.set(att.id, { state: 'uploading', percent: 0 });
          return next;
        });

        try {
          const receiptId = await uploadReceipt(att, (percent) => {
            setUploadProgress((prev) => {
              const next = new Map(prev);
              next.set(att.id, { state: 'uploading', percent });
              return next;
            });
          });

          setUploadProgress((prev) => {
            const next = new Map(prev);
            next.set(att.id, { state: 'done', percent: 100, receiptId });
            return next;
          });

          uploadedIds.push(receiptId);
        } catch (uploadErr: any) {
          setUploadProgress((prev) => {
            const next = new Map(prev);
            next.set(att.id, {
              state: 'failed',
              percent: 0,
              errorKey: uploadErr?.code ?? 'receiptUploadFailed',
            });
            return next;
          });

          setError(uploadErr?.message ?? 'Upload failed');
          setIsSaving(false);
          return; // Stop at first failure
        }
      }

      // Call the appropriate API based on mode
      if (mode === 'add-only') {
        await addReceiptsToTransaction(transactionId, uploadedIds);
      } else {
        const keptIds = Array.from(keptReceiptIds);
        const allIds = [...keptIds, ...uploadedIds];
        await updateTransactionReceipts(transactionId, allIds);
      }

      onSuccess();
    } catch (saveErr: any) {
      setError(saveErr?.message ?? 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave,
    newAttachments,
    uploadProgress,
    mode,
    transactionId,
    keptReceiptIds,
    onSuccess,
  ]);

  const state: ReceiptEditorState = {
    existingReceipts,
    keptReceiptIds,
    newAttachments,
    uploadProgress,
    isSaving,
    error,
  };

  return {
    state,
    addAttachment,
    removeAttachment,
    toggleExistingReceipt,
    save,
    canSave,
  };
}
