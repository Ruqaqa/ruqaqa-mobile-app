import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DownloadFormat,
  DownloadSnapshot,
  EMPTY_DOWNLOAD_SNAPSHOT,
  MediaItem,
} from '../types';
import {
  downloadItems,
  subscribeToDownloads,
  cancelDownload,
  cancelAllDownloads,
  clearCompletedDownloads,
} from '../services/downloadService';

export interface UseDownloadReturn {
  snapshot: DownloadSnapshot;
  startDownload: (items: MediaItem[], format?: DownloadFormat) => Promise<void>;
  cancel: (jobId: string) => void;
  cancelAll: () => void;
  clearCompleted: () => void;
}

/**
 * React hook for download operations.
 * Subscribes to download queue state and exposes download actions.
 */
export function useDownload(): UseDownloadReturn {
  const [snapshot, setSnapshot] = useState<DownloadSnapshot>(EMPTY_DOWNLOAD_SNAPSHOT);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToDownloads((s) => {
      if (mountedRef.current) {
        setSnapshot(s);
      }
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const startDownload = useCallback(
    async (items: MediaItem[], format?: DownloadFormat) => {
      await downloadItems(items, format);
    },
    [],
  );

  const cancel = useCallback((jobId: string) => {
    cancelDownload(jobId);
  }, []);

  const handleCancelAll = useCallback(() => {
    cancelAllDownloads();
  }, []);

  const handleClearCompleted = useCallback(() => {
    clearCompletedDownloads();
  }, []);

  return {
    snapshot,
    startDownload,
    cancel,
    cancelAll: handleCancelAll,
    clearCompleted: handleClearCompleted,
  };
}
