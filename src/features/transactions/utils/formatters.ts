import { TransactionEmployee } from '../types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format ISO date string to "DD MMM YYYY". Returns em-dash for invalid/empty input. */
export function formatDate(value: string | undefined): string {
  if (!value) return '\u2014';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '\u2014';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/** Format number to comma-separated string with 2 decimal places. */
export function formatAmount(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
