/**
 * Tests that ReconciliationFormScreen consumes shared files
 * on mount when the share intent targets 'reconciliation'.
 *
 * We test the consumption logic in isolation via the shareIntentStore
 * and convertSharedFilesToAttachments — no need to render the full screen.
 */

import { shareIntentStore } from '@/services/shareIntent/shareIntentStore';
import { convertSharedFilesToAttachments } from '@/utils/sharedFilesAdapter';
import type { SharedFile } from '@/services/shareIntent/shareIntentTypes';

function makeSharedFile(overrides: Partial<SharedFile> = {}): SharedFile {
  return {
    uri: 'file:///tmp/photo.jpg',
    mimeType: 'image/jpeg',
    fileType: 'image',
    fileName: 'photo.jpg',
    fileSize: 1024,
    ...overrides,
  };
}

afterEach(() => {
  shareIntentStore.clear();
});

describe('reconciliation shared files consumption', () => {
  it('consumeFiles returns files when targetId is reconciliation', () => {
    const file = makeSharedFile();
    shareIntentStore.setFiles([file]);
    shareIntentStore.selectFlow('reconciliation');

    const state = shareIntentStore.getState();
    expect(state.status).toBe('flow_selected');
    expect(state.status === 'flow_selected' && state.targetId).toBe('reconciliation');

    const consumed = shareIntentStore.consumeFiles();
    expect(consumed).toHaveLength(1);
    expect(consumed[0].uri).toBe('file:///tmp/photo.jpg');

    // After consumption, store is idle
    expect(shareIntentStore.getState().status).toBe('idle');
  });

  it('consumeFiles is idempotent — second call returns empty', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('reconciliation');

    const first = shareIntentStore.consumeFiles();
    expect(first).toHaveLength(1);

    const second = shareIntentStore.consumeFiles();
    expect(second).toHaveLength(0);
  });

  it('does not consume files when targetId is not reconciliation', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('transaction');

    const state = shareIntentStore.getState();
    expect(state.status === 'flow_selected' && state.targetId).toBe('transaction');

    // A reconciliation consumer should check targetId before consuming
    if (state.status === 'flow_selected' && state.targetId === 'reconciliation') {
      shareIntentStore.consumeFiles();
    }

    // Files are still in the store (not consumed by reconciliation)
    expect(shareIntentStore.getState().status).toBe('flow_selected');
  });

  it('converts consumed files to attachments with maxAttachments=4', () => {
    const files = [makeSharedFile(), makeSharedFile({ fileName: 'doc.pdf', mimeType: 'application/pdf', fileType: 'document' })];
    const { attachments, overflow } = convertSharedFilesToAttachments(files, 0, 4);
    expect(attachments).toHaveLength(2);
    expect(overflow).toBe(0);
    expect(attachments[0].type).toBe('image');
    expect(attachments[1].type).toBe('document');
  });
});
