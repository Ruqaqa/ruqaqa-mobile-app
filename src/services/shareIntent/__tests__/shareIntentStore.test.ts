/**
 * Tests for shareIntentStore — in-memory pub/sub store for share intent state.
 *
 * State machine: idle -> files_received -> flow_selected -> idle (consumed)
 */

import { shareIntentStore } from '../shareIntentStore';
import type { SharedFile, ShareIntentState } from '../shareIntentTypes';

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

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('starts in idle status', () => {
    expect(shareIntentStore.getState().status).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// setFiles
// ---------------------------------------------------------------------------

describe('setFiles', () => {
  it('transitions to files_received with the given files', () => {
    const files = [makeSharedFile()];
    shareIntentStore.setFiles(files);
    const state = shareIntentStore.getState();
    expect(state.status).toBe('files_received');
    if (state.status === 'files_received') {
      expect(state.files).toHaveLength(1);
      expect(state.files[0].uri).toBe('file:///data/photo.jpg');
    }
  });

  it('overwrites previous files when called again', () => {
    shareIntentStore.setFiles([makeSharedFile({ uri: 'file:///a.jpg' })]);
    shareIntentStore.setFiles([makeSharedFile({ uri: 'file:///b.jpg' })]);
    const state = shareIntentStore.getState();
    if (state.status === 'files_received') {
      expect(state.files).toHaveLength(1);
      expect(state.files[0].uri).toBe('file:///b.jpg');
    }
  });
});

// ---------------------------------------------------------------------------
// selectFlow
// ---------------------------------------------------------------------------

describe('selectFlow', () => {
  it('transitions from files_received to flow_selected', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('transaction');
    const state = shareIntentStore.getState();
    expect(state.status).toBe('flow_selected');
    if (state.status === 'flow_selected') {
      expect(state.targetId).toBe('transaction');
      expect(state.files).toHaveLength(1);
    }
  });

  it('is a no-op when state is idle', () => {
    shareIntentStore.selectFlow('transaction');
    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('is a no-op when state is already flow_selected', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('transaction');
    shareIntentStore.selectFlow('gallery');
    const state = shareIntentStore.getState();
    if (state.status === 'flow_selected') {
      expect(state.targetId).toBe('transaction');
    }
  });
});

// ---------------------------------------------------------------------------
// consumeFiles
// ---------------------------------------------------------------------------

describe('consumeFiles', () => {
  it('returns files from flow_selected and transitions to idle', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('transaction');
    const files = shareIntentStore.consumeFiles();
    expect(files).toHaveLength(1);
    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('returns files from files_received state too', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    const files = shareIntentStore.consumeFiles();
    expect(files).toHaveLength(1);
    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('returns empty array when idle', () => {
    const files = shareIntentStore.consumeFiles();
    expect(files).toEqual([]);
    expect(shareIntentStore.getState().status).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('clear', () => {
  it('transitions from files_received to idle', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.clear();
    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('transitions from flow_selected to idle', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('transaction');
    shareIntentStore.clear();
    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('is a safe no-op when already idle', () => {
    shareIntentStore.clear();
    expect(shareIntentStore.getState().status).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Subscriber notifications
// ---------------------------------------------------------------------------

describe('subscribers', () => {
  it('notifies on setFiles', () => {
    const listener = jest.fn();
    shareIntentStore.subscribe(listener);
    shareIntentStore.setFiles([makeSharedFile()]);
    expect(listener).toHaveBeenCalledTimes(1);
    const state: ShareIntentState = listener.mock.calls[0][0];
    expect(state.status).toBe('files_received');
  });

  it('notifies on selectFlow', () => {
    const listener = jest.fn();
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.subscribe(listener);
    shareIntentStore.selectFlow('transaction');
    expect(listener).toHaveBeenCalledTimes(1);
    const state: ShareIntentState = listener.mock.calls[0][0];
    expect(state.status).toBe('flow_selected');
  });

  it('notifies on consumeFiles', () => {
    const listener = jest.fn();
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.subscribe(listener);
    shareIntentStore.consumeFiles();
    expect(listener).toHaveBeenCalledTimes(1);
    const state: ShareIntentState = listener.mock.calls[0][0];
    expect(state.status).toBe('idle');
  });

  it('notifies on clear', () => {
    const listener = jest.fn();
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.subscribe(listener);
    shareIntentStore.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes listener', () => {
    const listener = jest.fn();
    const unsubscribe = shareIntentStore.subscribe(listener);
    unsubscribe();
    shareIntentStore.setFiles([makeSharedFile()]);
    expect(listener).not.toHaveBeenCalled();
  });
});
