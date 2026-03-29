/**
 * Tests for useShareIntent hook — bridges shareIntentStore to React components
 * using useSyncExternalStore.
 */

import { renderHook, act } from '@testing-library/react-native';
import { shareIntentStore } from '@/services/shareIntent/shareIntentStore';
import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';
import { useShareIntent } from '../useShareIntent';

function makeSharedFile(overrides: Partial<SharedFile> = {}): SharedFile {
  return {
    uri: 'file:///data/photo.jpg',
    mimeType: 'image/jpeg',
    fileType: 'image',
    fileName: 'photo.jpg',
    fileSize: 1024,
    ...overrides,
  };
}

beforeEach(() => {
  shareIntentStore.clear();
});

describe('useShareIntent', () => {
  it('returns idle state initially', () => {
    const { result } = renderHook(() => useShareIntent());
    expect(result.current.state.status).toBe('idle');
    expect(result.current.hasPendingFiles).toBe(false);
    expect(result.current.pendingFiles).toEqual([]);
    expect(result.current.pendingFileCount).toBe(0);
  });

  it('reflects files_received state when store has files', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    const { result } = renderHook(() => useShareIntent());
    expect(result.current.hasPendingFiles).toBe(true);
    expect(result.current.pendingFiles).toHaveLength(1);
    expect(result.current.pendingFileCount).toBe(1);
  });

  it('re-renders when store state changes externally', () => {
    const { result } = renderHook(() => useShareIntent());
    expect(result.current.hasPendingFiles).toBe(false);

    act(() => {
      shareIntentStore.setFiles([makeSharedFile()]);
    });

    expect(result.current.hasPendingFiles).toBe(true);
    expect(result.current.pendingFiles).toHaveLength(1);
  });

  it('selectFlow transitions store to flow_selected', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    const { result } = renderHook(() => useShareIntent());

    act(() => {
      result.current.selectFlow('transaction');
    });

    expect(result.current.state.status).toBe('flow_selected');
    expect(result.current.hasPendingFiles).toBe(true);
  });

  it('consumeFiles returns files and transitions to idle', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('transaction');
    const { result } = renderHook(() => useShareIntent());

    let consumed: SharedFile[];
    act(() => {
      consumed = result.current.consumeFiles();
    });

    expect(consumed!).toHaveLength(1);
    expect(result.current.state.status).toBe('idle');
    expect(result.current.hasPendingFiles).toBe(false);
  });

  it('clear discards files and transitions to idle', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    const { result } = renderHook(() => useShareIntent());

    act(() => {
      result.current.clear();
    });

    expect(result.current.hasPendingFiles).toBe(false);
    expect(result.current.pendingFiles).toEqual([]);
  });

  it('unsubscribes on unmount without errors', () => {
    const { unmount } = renderHook(() => useShareIntent());
    unmount();
    // Adding files after unmount should not cause errors
    shareIntentStore.setFiles([makeSharedFile()]);
  });
});
