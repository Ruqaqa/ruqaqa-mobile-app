import { UserPermissions } from '@/types/permissions';
import { Transaction } from '../types';

export type ReceiptEditMode = 'add-only' | 'full-edit' | null;

/**
 * Check if user can add receipts as the partner party.
 *
 * Requirements (mirrors Flutter _canAddReceiptsAsPartner):
 * 1. User has canAddReceiptsToSubmitted permission
 * 2. currentEmployeeId is not null
 * 3. Transaction partnerType is 'employee'
 * 4. Transaction partnerEmployee ID matches currentEmployeeId
 */
export function canAddReceiptsAsPartner(
  transaction: Transaction,
  permissions: UserPermissions,
  currentEmployeeId: string | null,
): boolean {
  if (!permissions.canAddReceiptsToSubmitted) return false;
  if (!currentEmployeeId) return false;
  if (transaction.partnerType !== 'employee') return false;

  const partnerEmployee = transaction.partnerEmployee;
  if (!partnerEmployee) return false;

  const partnerId =
    typeof partnerEmployee === 'string'
      ? partnerEmployee
      : partnerEmployee.id;

  return partnerId === currentEmployeeId;
}

/**
 * Determine which edit mode (if any) applies for this transaction + user.
 *
 * Priority: full-edit > add-only > null
 */
export function getReceiptEditMode(
  transaction: Transaction,
  permissions: UserPermissions,
  currentEmployeeId: string | null,
): ReceiptEditMode {
  if (permissions.canUpdateTransactions) return 'full-edit';
  if (canAddReceiptsAsPartner(transaction, permissions, currentEmployeeId)) {
    return 'add-only';
  }
  return null;
}
