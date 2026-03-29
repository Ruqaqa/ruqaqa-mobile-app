import { useSyncExternalStore, useCallback } from 'react';
import { shareIntentStore } from '@/services/shareIntent/shareIntentStore';
import type { ShareIntentState, ShareFlowTargetId, SharedFile } from '@/services/shareIntent/shareIntentTypes';

export function useShareIntent() {
  const state: ShareIntentState = useSyncExternalStore(
    shareIntentStore.subscribe,
    shareIntentStore.getState,
  );

  const hasPendingFiles = state.status === 'files_received' || state.status === 'flow_selected';

  const pendingFiles: SharedFile[] =
    state.status === 'files_received' || state.status === 'flow_selected'
      ? state.files
      : [];

  const selectFlow = useCallback((targetId: ShareFlowTargetId) => {
    shareIntentStore.selectFlow(targetId);
  }, []);

  const consumeFiles = useCallback(() => {
    return shareIntentStore.consumeFiles();
  }, []);

  const clear = useCallback(() => {
    shareIntentStore.clear();
  }, []);

  return {
    state,
    hasPendingFiles,
    pendingFiles,
    pendingFileCount: pendingFiles.length,
    selectFlow,
    consumeFiles,
    clear,
  };
}
