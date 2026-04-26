import {
  canAddReceiptsAsPartner,
  getReceiptEditMode,
} from '../utils/receiptEditorPermissions';
import { UserPermissions } from '@/types/permissions';
import { Transaction } from '../types';

/** Minimal permission set: all false */
const NO_PERMS: UserPermissions = {
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
};

/** Transaction with employee partner matching a given employee ID */
function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    statement: 'Test',
    totalAmount: -100,
    currency: 'SAR',
    createdAt: '2025-01-01T00:00:00Z',
    approvalStatus: 'Pending',
    partnerType: 'employee',
    partnerEmployee: { id: 'emp-1', firstName: 'Test' },
    ...overrides,
  };
}

// -------------------------------------------------------
// canAddReceiptsAsPartner
// -------------------------------------------------------

describe('canAddReceiptsAsPartner', () => {
  it('returns false when user lacks canAddReceiptsToSubmitted permission', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction(),
      { ...NO_PERMS, canAddReceiptsToSubmitted: false },
      'emp-1',
    );
    expect(result).toBe(false);
  });

  it('returns false when currentEmployeeId is null', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction(),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      null,
    );
    expect(result).toBe(false);
  });

  it('returns false when partnerType is not employee', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction({ partnerType: 'المحفظة' }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe(false);
  });

  it('returns false when partnerType is undefined', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction({ partnerType: undefined }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe(false);
  });

  it('returns false when partnerEmployee ID does not match currentEmployeeId', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction({ partnerEmployee: { id: 'emp-other' } }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe(false);
  });

  it('returns true when all conditions are met (object partnerEmployee)', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction({ partnerEmployee: { id: 'emp-1' } }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe(true);
  });

  it('handles partnerEmployee as string ID (legacy format)', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction({ partnerEmployee: 'emp-1' }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe(true);
  });

  it('handles partnerEmployee as string that does not match', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction({ partnerEmployee: 'emp-other' }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe(false);
  });

  it('returns false when partnerEmployee is undefined', () => {
    const result = canAddReceiptsAsPartner(
      makeTransaction({ partnerEmployee: undefined }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe(false);
  });
});

// -------------------------------------------------------
// getReceiptEditMode
// -------------------------------------------------------

describe('getReceiptEditMode', () => {
  it('returns full-edit when user has canUpdateTransactions', () => {
    const result = getReceiptEditMode(
      makeTransaction(),
      { ...NO_PERMS, canUpdateTransactions: true },
      'emp-1',
    );
    expect(result).toBe('full-edit');
  });

  it('returns add-only when canAddReceiptsAsPartner conditions are met', () => {
    const result = getReceiptEditMode(
      makeTransaction({ partnerEmployee: { id: 'emp-1' } }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe('add-only');
  });

  it('returns null when user has no relevant permissions', () => {
    const result = getReceiptEditMode(
      makeTransaction(),
      NO_PERMS,
      'emp-1',
    );
    expect(result).toBeNull();
  });

  it('full-edit takes priority over add-only when user has both permissions', () => {
    const result = getReceiptEditMode(
      makeTransaction({ partnerEmployee: { id: 'emp-1' } }),
      { ...NO_PERMS, canUpdateTransactions: true, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBe('full-edit');
  });

  it('returns null when canAddReceiptsToSubmitted but not partner employee', () => {
    const result = getReceiptEditMode(
      makeTransaction({ partnerEmployee: { id: 'emp-other' } }),
      { ...NO_PERMS, canAddReceiptsToSubmitted: true },
      'emp-1',
    );
    expect(result).toBeNull();
  });

  it('returns full-edit even when not the partner employee', () => {
    const result = getReceiptEditMode(
      makeTransaction({ partnerEmployee: { id: 'emp-other' } }),
      { ...NO_PERMS, canUpdateTransactions: true },
      'emp-1',
    );
    expect(result).toBe('full-edit');
  });
});
