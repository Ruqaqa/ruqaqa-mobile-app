import { useState, useCallback, useRef } from 'react';
import {
  deleteMediaItem,
  fetchMediaItemDetail,
  manageMediaItem,
} from '../services/galleryService';
import {
  BulkActionResult,
  BulkActionProgress,
  BulkOutcome,
  ManageItemPayload,
  MediaItemDetail,
} from '../types';

export interface UseMediaBulkActionsReturn {
  bulkDelete: (ids: string[]) => Promise<BulkActionResult | null>;
  bulkManage: (ids: string[], payload: ManageItemPayload) => Promise<BulkActionResult | null>;
  fetchBulkState: (ids: string[]) => Promise<MediaItemDetail[]>;
  isProcessing: boolean;
  isFetchingState: boolean;
  progress: BulkActionProgress;
}

export function useMediaBulkActions(): UseMediaBulkActionsReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingState, setIsFetchingState] = useState(false);
  const [progress, setProgress] = useState<BulkActionProgress>({
    completed: 0,
    total: 0,
  });

  const processingRef = useRef(false);

  const bulkDelete = useCallback(
    async (ids: string[]): Promise<BulkActionResult | null> => {
      if (processingRef.current) return null;
      processingRef.current = true;
      setIsProcessing(true);
      setProgress({ completed: 0, total: ids.length });

      const succeededIds: string[] = [];
      const failedIds: string[] = [];

      try {
        for (let i = 0; i < ids.length; i++) {
          try {
            await deleteMediaItem(ids[i]);
            succeededIds.push(ids[i]);
          } catch {
            failedIds.push(ids[i]);
          }
          setProgress({ completed: i + 1, total: ids.length });
        }

        const outcome: BulkOutcome =
          failedIds.length === 0
            ? 'allSucceeded'
            : succeededIds.length === 0
              ? 'allFailed'
              : 'partialFailure';

        return { outcome, succeededIds, failedIds };
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [],
  );

  const bulkManage = useCallback(
    async (
      ids: string[],
      payload: ManageItemPayload,
    ): Promise<BulkActionResult | null> => {
      if (processingRef.current) return null;
      processingRef.current = true;
      setIsProcessing(true);
      setProgress({ completed: 0, total: ids.length });

      const succeededIds: string[] = [];
      const failedIds: string[] = [];

      try {
        for (let i = 0; i < ids.length; i++) {
          try {
            await manageMediaItem(ids[i], payload);
            succeededIds.push(ids[i]);
          } catch {
            failedIds.push(ids[i]);
          }
          setProgress({ completed: i + 1, total: ids.length });
        }

        const outcome: BulkOutcome =
          failedIds.length === 0
            ? 'allSucceeded'
            : succeededIds.length === 0
              ? 'allFailed'
              : 'partialFailure';

        return { outcome, succeededIds, failedIds };
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [],
  );

  const fetchBulkState = useCallback(
    async (ids: string[]): Promise<MediaItemDetail[]> => {
      setIsFetchingState(true);

      try {
        const results: MediaItemDetail[] = [];
        for (const id of ids) {
          try {
            const detail = await fetchMediaItemDetail(id);
            results.push(detail);
          } catch {
            // Skip items that fail to fetch
          }
        }
        return results;
      } finally {
        setIsFetchingState(false);
      }
    },
    [],
  );

  return {
    bulkDelete,
    bulkManage,
    fetchBulkState,
    isProcessing,
    isFetchingState,
    progress,
  };
}
