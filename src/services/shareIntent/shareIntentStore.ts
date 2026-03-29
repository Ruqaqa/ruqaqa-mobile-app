import type { SharedFile, ShareIntentState, ShareFlowTargetId } from './shareIntentTypes';

type Listener = (state: ShareIntentState) => void;

let currentState: ShareIntentState = { status: 'idle' };
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener(currentState);
  }
}

export const shareIntentStore = {
  getState(): ShareIntentState {
    return currentState;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  setFiles(files: SharedFile[]): void {
    currentState = { status: 'files_received', files };
    notify();
  },

  selectFlow(targetId: ShareFlowTargetId): void {
    if (currentState.status !== 'files_received') return;
    currentState = { status: 'flow_selected', files: currentState.files, targetId };
    notify();
  },

  consumeFiles(): SharedFile[] {
    if (currentState.status !== 'flow_selected' && currentState.status !== 'files_received') {
      return [];
    }
    const files = currentState.files;
    currentState = { status: 'idle' };
    notify();
    return files;
  },

  clear(): void {
    currentState = { status: 'idle' };
    notify();
  },
};
