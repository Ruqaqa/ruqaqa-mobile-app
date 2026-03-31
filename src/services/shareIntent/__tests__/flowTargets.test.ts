/**
 * Tests for flow targets — permission gating for each share flow target.
 */

import { SHARE_FLOW_TARGETS } from '../flowTargets';
import type { UserPermissions } from '@/types/permissions';

function makePermissions(overrides: Partial<UserPermissions> = {}): UserPermissions {
  return {
    canAccessFinance: false,
    canAccessGallery: false,
    canCreateTransactions: false,
    canViewTransactionHistory: false,
    canViewAllTransactions: false,
    canUpdateTransactions: false,
    canSelectPartner: false,
    canAddReceiptsToSubmitted: false,
    canCreateReconciliation: false,
    canViewReconciliationHistory: false,
    canViewAllReconciliations: false,
    canUpdateReconciliation: false,
    canViewGallery: false,
    canCreateGallery: false,
    canUpdateGallery: false,
    canDeleteGallery: false,
    ...overrides,
  };
}

describe('SHARE_FLOW_TARGETS', () => {
  it('has three targets', () => {
    expect(SHARE_FLOW_TARGETS).toHaveLength(3);
  });

  it('includes transaction, reconciliation, and gallery', () => {
    const ids = SHARE_FLOW_TARGETS.map((t) => t.id);
    expect(ids).toEqual(['transaction', 'reconciliation', 'gallery']);
  });
});

describe('transaction target', () => {
  const target = SHARE_FLOW_TARGETS.find((t) => t.id === 'transaction')!;

  it('is available when canCreateTransactions is true', () => {
    expect(target.isAvailable(makePermissions({ canCreateTransactions: true }))).toBe(true);
  });

  it('is unavailable when canCreateTransactions is false', () => {
    expect(target.isAvailable(makePermissions())).toBe(false);
  });

  it('has maxFiles of 4', () => {
    expect(target.maxFiles).toBe(4);
  });
});

describe('reconciliation target', () => {
  const target = SHARE_FLOW_TARGETS.find((t) => t.id === 'reconciliation')!;

  it('is available when canCreateReconciliation is true', () => {
    expect(target.isAvailable(makePermissions({ canCreateReconciliation: true }))).toBe(true);
  });

  it('is unavailable when canCreateReconciliation is false', () => {
    expect(target.isAvailable(makePermissions())).toBe(false);
  });

  it('has maxFiles of 4', () => {
    expect(target.maxFiles).toBe(4);
  });

  it('has explicit allowedMimeTypes', () => {
    expect(target.allowedMimeTypes).not.toBeNull();
    expect(target.allowedMimeTypes).toContain('image/jpeg');
    expect(target.allowedMimeTypes).toContain('application/pdf');
  });
});

describe('gallery target', () => {
  const target = SHARE_FLOW_TARGETS.find((t) => t.id === 'gallery')!;

  it('is available when canCreateGallery is true', () => {
    expect(target.isAvailable(makePermissions({ canCreateGallery: true }))).toBe(true);
  });

  it('is unavailable when canCreateGallery is false', () => {
    expect(target.isAvailable(makePermissions())).toBe(false);
  });

  it('has maxFiles of 10', () => {
    expect(target.maxFiles).toBe(10);
  });
});
