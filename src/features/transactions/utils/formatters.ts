import { TransactionEmployee } from '../types';

export { formatDate, formatAmount, formatDateParam } from '@/utils/formatters';

/** Return the theme color key for an amount value. */
export function getAmountColor(
  amount: number,
): 'success' | 'error' | 'foregroundSecondary' {
  if (amount > 0) return 'success';
  if (amount < 0) return 'error';
  return 'foregroundSecondary';
}

/** Get display string for a transaction's partner. */
export function getPartnerDisplay(params: {
  partnerType?: 'employee' | 'wallet';
  partnerEmployee?: TransactionEmployee | string;
}): string | null {
  const { partnerType, partnerEmployee } = params;

  if (partnerType === 'wallet') return 'Wallet';

  if (partnerEmployee) {
    if (typeof partnerEmployee === 'string') return partnerEmployee;
    return getEmployeeDisplay(partnerEmployee);
  }

  if (!partnerType) return null;
  return null;
}

/** Flow direction type for the transaction flow widget. */
export type FlowDirection = 'expense' | 'income';

/** Determine flow direction from totalAmount: negative = expense, zero/positive = income. */
export function getFlowDirection(totalAmount: number): FlowDirection {
  return totalAmount < 0 ? 'expense' : 'income';
}

/** Get display string for an employee reference. Handles object, string, null, undefined. */
export function getEmployeeDisplay(
  employee: TransactionEmployee | string | null | undefined,
): string | null {
  if (employee === null || employee === undefined) return null;
  if (typeof employee === 'string') return employee;

  const { firstName, lastName, email, id } = employee;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (email) return email;
  return id;
}
