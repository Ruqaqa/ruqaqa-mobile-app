/**
 * Tests for FinanceShell's share intent auto-open logic.
 *
 * Verifies that when the share intent store transitions to flow_selected,
 * the correct form is opened based on targetId.
 *
 * We test the branching logic directly since FinanceShell is too expensive
 * to render in unit tests (many providers, modals, tab navigation).
 */

import { shareIntentStore } from '@/services/shareIntent/shareIntentStore';
import type { ShareFlowTargetId, SharedFile } from '@/services/shareIntent/shareIntentTypes';

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

afterEach(() => {
  shareIntentStore.clear();
});

/**
 * Simulates the FinanceShell useEffect logic:
 *   if (shareState.status === 'flow_selected') {
 *     if (shareState.targetId === 'transaction') → open transaction form
 *     else if (shareState.targetId === 'reconciliation') → switch tab + open recon form
 *   }
 */
function simulateFinanceShellAutoOpen(state: ReturnType<typeof shareIntentStore.getState>) {
  const result = { formVisible: false, reconciliationFormVisible: false, activeTab: 'operations' as string };

  if (state.status === 'flow_selected') {
    if (state.targetId === 'transaction') {
      result.formVisible = true;
    } else if (state.targetId === 'reconciliation') {
      result.activeTab = 'reconciliation';
      result.reconciliationFormVisible = true;
    }
  }

  return result;
}

describe('FinanceShell share intent auto-open logic', () => {
  it('opens transaction form when targetId is transaction', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('transaction');
    const state = shareIntentStore.getState();
    const result = simulateFinanceShellAutoOpen(state);
    expect(result.formVisible).toBe(true);
    expect(result.reconciliationFormVisible).toBe(false);
    expect(result.activeTab).toBe('operations');
  });

  it('opens reconciliation form and switches tab when targetId is reconciliation', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('reconciliation');
    const state = shareIntentStore.getState();
    const result = simulateFinanceShellAutoOpen(state);
    expect(result.formVisible).toBe(false);
    expect(result.reconciliationFormVisible).toBe(true);
    expect(result.activeTab).toBe('reconciliation');
  });

  it('does nothing when state is idle', () => {
    const state = shareIntentStore.getState();
    const result = simulateFinanceShellAutoOpen(state);
    expect(result.formVisible).toBe(false);
    expect(result.reconciliationFormVisible).toBe(false);
    expect(result.activeTab).toBe('operations');
  });

  it('does nothing when state is files_received (no flow selected yet)', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    const state = shareIntentStore.getState();
    const result = simulateFinanceShellAutoOpen(state);
    expect(result.formVisible).toBe(false);
    expect(result.reconciliationFormVisible).toBe(false);
  });

  it('does nothing for gallery targetId (handled by GalleryShell)', () => {
    shareIntentStore.setFiles([makeSharedFile()]);
    shareIntentStore.selectFlow('gallery');
    const state = shareIntentStore.getState();
    const result = simulateFinanceShellAutoOpen(state);
    expect(result.formVisible).toBe(false);
    expect(result.reconciliationFormVisible).toBe(false);
  });
});
